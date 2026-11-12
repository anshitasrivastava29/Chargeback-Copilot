import logging
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.timeutils import days_until, to_ms, utcnow
from app.models.ai_result import AIResult
from app.models.dispute import Dispute
from app.services import case_context
from app.services.ai.classifier import classify
from app.services.ai.drafts import (
    build_heuristic_draft,
    build_llm_prompt,
    next_step,
    validate_llm_draft,
)
from app.services.ai.evidence_analyzer import analyze_evidence
from app.services.ai.llm import LLMClient
from app.services.ai.recommender import build_recommendations, recommendation_panel
from app.services.ai.risk import build_factors, build_risk, calculate_win_likelihood

logger = logging.getLogger(__name__)

HEURISTIC_MODEL = "heuristic-v1"


class DisputeIntelligenceEngine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.llm = LLMClient(settings)

    def analyze(
        self,
        db: Session,
        dispute: Dispute,
        merchant_name: str,
        force: bool = False,
    ) -> dict:
        started = time.perf_counter()
        files = list(dispute.evidence_files)
        analysis = analyze_evidence(dispute, files)

        latest = db.scalars(
            select(AIResult)
            .where(AIResult.dispute_id == dispute.id)
            .order_by(AIResult.generated_at.desc())
            .limit(1)
        ).first()

        if latest and latest.evidence_fingerprint == analysis.fingerprint and not force:
            payload = self._serialize(latest)
            self._apply_saved_draft(payload, dispute)
            logger.info(
                "ai.analysis source=cache dispute=%s model=%s duration_ms=%.1f",
                dispute.id,
                latest.model,
                (time.perf_counter() - started) * 1000,
            )
            return payload

        result = self._generate(db, dispute, analysis, merchant_name)
        payload = self._serialize(result)
        self._apply_saved_draft(payload, dispute)
        logger.info(
            "ai.analysis source=generated dispute=%s model=%s ai_mode=%s duration_ms=%.1f",
            dispute.id,
            result.model,
            self.settings.ai_mode,
            (time.perf_counter() - started) * 1000,
        )
        return payload

    def _generate(self, db: Session, dispute: Dispute, analysis, merchant_name) -> AIResult:
        tracking = case_context.tracking_info(dispute, len(analysis.completed_types))
        refund = case_context.refund_info(dispute)
        due_days = days_until(dispute.due_at)

        classification = classify(
            dispute, len(analysis.completed_types), len(analysis.required_types)
        )
        risk = build_risk(
            dispute,
            len(analysis.missing_types),
            due_days,
            analysis.critical_signal_count,
        )
        win_likelihood = calculate_win_likelihood(dispute, analysis, tracking, refund)
        recommendations = build_recommendations(
            dispute, analysis.missing_types, analysis.signals
        )
        panel = recommendation_panel(dispute, analysis.missing_types)
        step = next_step(dispute, analysis, tracking)
        factors = build_factors(dispute, analysis, tracking, refund)

        draft = build_heuristic_draft(dispute, analysis, tracking, refund, merchant_name)
        model = HEURISTIC_MODEL
        llm_used = False
        fallback_reason = "disabled" if not self.llm.enabled else None

        if self.llm.enabled:
            system, user = build_llm_prompt(
                dispute, analysis, tracking, refund, merchant_name
            )
            llm_draft = self.llm.complete(system, user)
            if llm_draft and validate_llm_draft(llm_draft, dispute):
                draft = llm_draft.strip()
                model = f"{HEURISTIC_MODEL}+{self.settings.llm_model}"
                llm_used = True
            elif llm_draft:
                fallback_reason = "validation_rejected"
            else:
                fallback_reason = "llm_unavailable"

        if self.llm.enabled:
            logger.info(
                "ai.draft dispute=%s model=%s llm_used=%s fallback=%s",
                dispute.id,
                model,
                llm_used,
                fallback_reason or "none",
            )

        result = AIResult(
            dispute_id=dispute.id,
            classification=classification,
            risk=risk,
            win_likelihood=win_likelihood,
            evidence_gaps=analysis.gaps,
            recommendations=recommendations,
            next_step=step,
            recommendation=panel,
            response_draft=draft,
            citations=analysis.citations,
            factors=factors,
            signals=analysis.signals,
            model=model,
            evidence_fingerprint=analysis.fingerprint,
            generated_at=utcnow(),
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return result

    @staticmethod
    def _serialize(result: AIResult) -> dict:
        return {
            "classification": result.classification,
            "risk": result.risk,
            "win_likelihood": result.win_likelihood,
            "evidence_gaps": result.evidence_gaps,
            "recommendations": result.recommendations,
            "next_step": result.next_step,
            "recommendation": result.recommendation,
            "response_draft": result.response_draft,
            "citations": result.citations or [],
            "factors": result.factors or [],
            "signals": result.signals or [],
            "model": result.model,
            "generated_at": to_ms(result.generated_at),
        }

    @staticmethod
    def _apply_saved_draft(payload: dict, dispute: Dispute) -> None:
        if dispute.response_draft:
            payload["response_draft"] = dispute.response_draft.draft

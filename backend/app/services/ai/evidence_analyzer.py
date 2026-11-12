import hashlib
import re
from dataclasses import dataclass, field

from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile
from app.services.ai.constants import (
    CRITICAL_EVIDENCE,
    DOCUMENT_KEYWORDS,
    EVIDENCE_CATALOG,
    EVIDENCE_GAP_NOTES,
    REQUIRED_TYPES_BY_REASON,
)

CATALOG_ORDER = [item["key"] for item in EVIDENCE_CATALOG]

_ID_PATTERNS = {
    "order_ids": re.compile(r"\bAC-\d{4,6}\b"),
    "transaction_ids": re.compile(r"\b[0-9A-Z]{17}\b"),
    "tracking_numbers": re.compile(
        r"\b(?:1Z[0-9A-Z]{16}|94\d{20,22}|JD\d{9}|\d{12})\b"
    ),
}


@dataclass
class EvidenceAnalysis:
    required_types: list[str]
    completed_types: list[str]
    missing_types: list[str]
    gaps: list[dict]
    signals: list[dict]
    quality_by_type: dict[str, int]
    citations: list[dict]
    fingerprint: str
    ready_files: list[EvidenceFile] = field(default_factory=list)

    @property
    def average_quality(self) -> float | None:
        if not self.quality_by_type:
            return None
        return sum(self.quality_by_type.values()) / len(self.quality_by_type)

    @property
    def critical_signal_count(self) -> int:
        return sum(1 for signal in self.signals if signal["severity"] == "critical")


def required_types_for(dispute: Dispute) -> list[str]:
    preferred = REQUIRED_TYPES_BY_REASON.get(dispute.reason, CATALOG_ORDER)
    ordered = list(preferred)
    for evidence_type in CATALOG_ORDER:
        if evidence_type not in ordered:
            ordered.append(evidence_type)
    return ordered[: max(1, min(dispute.required_evidence, len(CATALOG_ORDER)))]


def completed_types_for(files: list[EvidenceFile], required: list[str]) -> list[str]:
    required_set = set(required)
    completed = []
    for evidence_type in required:
        if evidence_type in required_set and any(
            file.status == "ready"
            and file.evidence_type == evidence_type
            for file in files
        ):
            completed.append(evidence_type)
    return completed


def _dedupe_signals(signals: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for signal in signals:
        key = (signal["code"], signal.get("evidence_type"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(signal)
    return unique


def _file_quality(file: EvidenceFile) -> int:
    if file.quality_score is not None:
        return file.quality_score
    if file.source == "demo":
        return 60
    return 55


def _document_signals(dispute: Dispute, files: list[EvidenceFile]) -> list[dict]:
    signals: list[dict] = []

    for file in files:
        if file.status != "ready":
            continue

        fields = file.extracted_fields or {}
        text = (file.extracted_text or "").lower()

        if file.extraction_status == "failed":
            signals.append(
                {
                    "code": "extraction_failed",
                    "severity": "supporting",
                    "message": f"{file.evidence_type} could not be read. Upload a clearer copy if possible.",
                    "evidence_type": file.evidence_type,
                }
            )
            continue

        if not text:
            continue

        keywords = DOCUMENT_KEYWORDS.get(file.evidence_type, ())
        if keywords and not any(keyword in text for keyword in keywords):
            signals.append(
                {
                    "code": "low_relevance",
                    "severity": "supporting",
                    "message": (
                        f"{file.evidence_type} does not mention the usual case markers "
                        f"({', '.join(keywords[:3])})."
                    ),
                    "evidence_type": file.evidence_type,
                }
            )

        if file.evidence_type == "Proof of delivery":
            has_tracking = bool(fields.get("tracking_numbers"))
            if not has_tracking and not any(
                word in text for word in ("delivered", "signature", "signed")
            ):
                signals.append(
                    {
                        "code": "delivery_evidence_weak",
                        "severity": "critical",
                        "message": (
                            "The delivery document has no tracking number or delivery "
                            "confirmation markers."
                        ),
                        "evidence_type": file.evidence_type,
                    }
                )

        if file.evidence_type == "Order confirmation":
            order_ids = fields.get("order_ids") or []
            if order_ids and dispute.order_id not in order_ids:
                signals.append(
                    {
                        "code": "order_mismatch",
                        "severity": "critical",
                        "message": (
                            f"The document references order {order_ids[0]}, not the "
                            f"disputed order {dispute.order_id}."
                        ),
                        "evidence_type": file.evidence_type,
                    }
                )

        if file.evidence_type == "Transaction verification":
            transaction_ids = fields.get("transaction_ids") or []
            if transaction_ids and dispute.transaction_id not in transaction_ids:
                signals.append(
                    {
                        "code": "transaction_mismatch",
                        "severity": "critical",
                        "message": (
                            "The document references a different transaction than the "
                            "one under dispute."
                        ),
                        "evidence_type": file.evidence_type,
                    }
                )

    return _dedupe_signals(signals)


def analyze_evidence(dispute: Dispute, files: list[EvidenceFile]) -> EvidenceAnalysis:
    required = required_types_for(dispute)
    completed = completed_types_for(files, required)
    missing = [item for item in required if item not in completed]
    critical = set(CRITICAL_EVIDENCE.get(dispute.reason, []))

    gaps = [
        {
            "type": evidence_type,
            "severity": "critical" if evidence_type in critical else "supporting",
            "note": EVIDENCE_GAP_NOTES.get(
                evidence_type,
                "Required by the evidence checklist for this dispute reason.",
            ),
        }
        for evidence_type in missing
    ]

    ready_files = [file for file in files if file.status == "ready"]
    quality_by_type: dict[str, int] = {}
    citations: list[dict] = []

    for file in ready_files:
        if file.evidence_type not in required:
            continue
        quality_by_type[file.evidence_type] = max(
            quality_by_type.get(file.evidence_type, 0), _file_quality(file)
        )
        excerpt = None
        if file.extracted_text:
            excerpt = " ".join(file.extracted_text.split())[:180]
        citations.append(
            {
                "evidence_type": file.evidence_type,
                "file_name": file.file_name,
                "excerpt": excerpt,
            }
        )

    signals = _document_signals(dispute, ready_files)

    fingerprint_source = "|".join(
        [
            dispute.id,
            dispute.status,
            dispute.reason,
            str(dispute.updated_at),
            *sorted(f"{file.id}:{file.status}:{file.quality_score}" for file in files),
        ]
    )
    fingerprint = hashlib.sha1(fingerprint_source.encode("utf-8")).hexdigest()[:16]

    return EvidenceAnalysis(
        required_types=required,
        completed_types=completed,
        missing_types=missing,
        gaps=gaps,
        signals=signals,
        quality_by_type=quality_by_type,
        citations=citations,
        fingerprint=fingerprint,
        ready_files=ready_files,
    )


def extract_fields(text: str) -> dict:
    fields: dict[str, list[str]] = {}
    for key, pattern in _ID_PATTERNS.items():
        matches = sorted(set(pattern.findall(text)))
        if matches:
            fields[key] = matches[:10]

    lower = text.lower()
    markers = [
        keyword
        for keyword in (
            "delivered",
            "signature",
            "refund",
            "cancel",
            "tracking",
            "authorization",
            "avs",
            "cvv",
            "invoice",
        )
        if keyword in lower
    ]
    if markers:
        fields["markers"] = markers

    return fields


def score_document(text: str, fields: dict, evidence_type: str) -> int:
    if not text.strip():
        return 40

    score = 60
    if len(text) >= 200:
        score += 10
    if len(text) >= 800:
        score += 5

    if fields.get("order_ids") or fields.get("transaction_ids"):
        score += 10
    if fields.get("tracking_numbers"):
        score += 10
    if fields.get("markers"):
        score += 5

    keywords = DOCUMENT_KEYWORDS.get(evidence_type, ())
    if keywords and any(keyword in text.lower() for keyword in keywords):
        score += 5

    return max(10, min(100, score))

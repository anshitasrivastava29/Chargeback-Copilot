import logging

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Optional OpenAI-compatible client used only for response drafting.

    All analytical fields stay deterministic; the LLM is constrained to the case
    facts and its output is validated before use.
    """

    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return self.settings.ai_mode != "heuristic" and bool(self.settings.llm_api_key)

    def complete(self, system: str, user: str) -> str | None:
        if not self.enabled:
            return None

        url = self.settings.llm_base_url.rstrip("/") + "/chat/completions"
        payload = {
            "model": self.settings.llm_model,
            "temperature": 0.2,
            "max_tokens": 700,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }

        try:
            # Malformed proxy vars on some machines (e.g. NO_PROXY=[::1])
            # crash httpx during mount parsing; LLM calls go direct.
            with httpx.Client(
                timeout=self.settings.llm_timeout_seconds, trust_env=False
            ) as client:
                response = client.post(
                    url,
                    json=payload,
                    headers={"Authorization": f"Bearer {self.settings.llm_api_key}"},
                )
                response.raise_for_status()
                data = response.json()
            return data["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            logger.warning("LLM draft generation failed, using heuristic fallback: %s", exc)
            return None

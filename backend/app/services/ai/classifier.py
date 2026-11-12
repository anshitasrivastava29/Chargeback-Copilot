from app.models.dispute import Dispute
from app.services.ai.constants import CLASSIFICATION_BY_REASON


def classify(dispute: Dispute, completed_count: int, required_count: int) -> dict:
    mapping = CLASSIFICATION_BY_REASON.get(dispute.reason)
    if not mapping:
        return {
            "category": "Uncategorized",
            "type": dispute.reason,
            "confidence": 75,
        }

    confidence = int(mapping["confidence"])
    if required_count:
        ratio = completed_count / required_count
        if ratio >= 0.8:
            confidence += 2
        elif ratio <= 0.2:
            confidence -= 3

    return {
        "category": mapping["category"],
        "type": mapping["type"],
        "confidence": max(70, min(98, confidence)),
    }

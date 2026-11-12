from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.core.timeutils import from_ms, utcnow
from app.models.dispute import Dispute
from app.models.evidence import EvidenceFile
from app.models.transaction import Transaction
from app.models.user import User
from app.services import case_context
from app.services.ai.evidence_analyzer import required_types_for

DEMO_EMAIL = "demo@acmecommerce.com"
DEMO_PASSWORD = "Demo1234!"

DAY = timedelta(days=1)
KB = 1024

DEMO_DISPUTES = [
    {"id": "PP-D-8492013", "name": "Jordan Ellis", "email": "jordan.ellis@example.com", "reason": "Item not received", "amount": 249.00, "status": "open", "priority": "high", "open": 2, "due": 1, "resolved": None, "uploaded": 2, "required": 4, "txn": "8AB12935KJ7731042", "order": "AC-10482"},
    {"id": "PP-D-8491874", "name": "Priya Nair", "email": "priya.nair@example.com", "reason": "Unauthorized transaction", "amount": 1180.00, "status": "open", "priority": "high", "open": 3, "due": 2, "resolved": None, "uploaded": 1, "required": 5, "txn": "2XM48291LP0043217", "order": "AC-10475"},
    {"id": "PP-D-8491520", "name": "Marcus Webb", "email": "marcus.webb@example.com", "reason": "Item not as described", "amount": 89.99, "status": "won", "priority": "low", "open": 28, "due": None, "resolved": 21, "uploaded": 4, "required": 4, "txn": "7RQ19304TN5582019", "order": "AC-10441"},
    {"id": "PP-D-8491409", "name": "Sofia Rodrigues", "email": "sofia.rodrigues@example.com", "reason": "Duplicate charge", "amount": 420.00, "status": "open", "priority": "high", "open": 5, "due": -1, "resolved": None, "uploaded": 3, "required": 4, "txn": "4PL62810KC3394712", "order": "AC-10420"},
    {"id": "PP-D-8491180", "name": "Daniel Kim", "email": "daniel.kim@example.com", "reason": "Subscription canceled", "amount": 29.00, "status": "lost", "priority": "low", "open": 35, "due": None, "resolved": 29, "uploaded": 2, "required": 3, "txn": "9WK38102YS6620184", "order": "AC-10396"},
    {"id": "PP-D-8490962", "name": "Amara Okafor", "email": "amara.okafor@example.com", "reason": "Item not received", "amount": 612.50, "status": "won", "priority": "medium", "open": 41, "due": None, "resolved": 33, "uploaded": 4, "required": 4, "txn": "3JD74029HQ1185307", "order": "AC-10371"},
    {"id": "PP-D-8490741", "name": "Liam Foster", "email": "liam.foster@example.com", "reason": "Item not as described", "amount": 1899.00, "status": "open", "priority": "high", "open": 1, "due": 3, "resolved": None, "uploaded": 0, "required": 5, "txn": "6BV20485MR9912470", "order": "AC-10352"},
    {"id": "PP-D-8490518", "name": "Emma Larsson", "email": "emma.larsson@example.com", "reason": "Unauthorized transaction", "amount": 74.25, "status": "won", "priority": "low", "open": 52, "due": None, "resolved": 44, "uploaded": 3, "required": 3, "txn": "1NC53847DX7720365", "order": "AC-10310"},
    {"id": "PP-D-8490327", "name": "Noah Bennett", "email": "noah.bennett@example.com", "reason": "Credit not processed", "amount": 310.00, "status": "lost", "priority": "medium", "open": 18, "due": None, "resolved": 9, "uploaded": 2, "required": 4, "txn": "5HT91730LQ3041968", "order": "AC-10289"},
    {"id": "PP-D-8489921", "name": "Yuki Tanaka", "email": "yuki.tanaka@example.com", "reason": "Item not received", "amount": 58.40, "status": "won", "priority": "low", "open": 61, "due": None, "resolved": 55, "uploaded": 3, "required": 3, "txn": "0GE46281PK5582037", "order": "AC-10244"},
    {"id": "PP-D-8489744", "name": "Isabella Rossi", "email": "isabella.rossi@example.com", "reason": "Duplicate charge", "amount": 1040.00, "status": "open", "priority": "high", "open": 4, "due": 2, "resolved": None, "uploaded": 2, "required": 4, "txn": "8LU17305WD6624901", "order": "AC-10218"},
    {"id": "PP-D-8489510", "name": "Ethan Clark", "email": "ethan.clark@example.com", "reason": "Subscription canceled", "amount": 18.99, "status": "won", "priority": "low", "open": 68, "due": None, "resolved": 60, "uploaded": 3, "required": 3, "txn": "2OT60938CR1183574", "order": "AC-10187"},
    {"id": "PP-D-8489302", "name": "Fatima Zahra", "email": "fatima.zahra@example.com", "reason": "Item not as described", "amount": 760.00, "status": "open", "priority": "medium", "open": 6, "due": 4, "resolved": None, "uploaded": 1, "required": 4, "txn": "7FI28154AZ9915026", "order": "AC-10160"},
    {"id": "PP-D-8489087", "name": "Lucas Meyer", "email": "lucas.meyer@example.com", "reason": "Item not received", "amount": 132.00, "status": "won", "priority": "low", "open": 73, "due": None, "resolved": 66, "uploaded": 3, "required": 3, "txn": "4DV93027QN7721683", "order": "AC-10122"},
    {"id": "PP-D-8488821", "name": "Grace Thompson", "email": "grace.thompson@example.com", "reason": "Unauthorized transaction", "amount": 2450.00, "status": "open", "priority": "high", "open": 2, "due": 1, "resolved": None, "uploaded": 3, "required": 5, "txn": "9TY51480BM3046291", "order": "AC-10098"},
    {"id": "PP-D-8488604", "name": "Omar Haddad", "email": "omar.haddad@example.com", "reason": "Duplicate charge", "amount": 95.00, "status": "won", "priority": "low", "open": 80, "due": None, "resolved": 72, "uploaded": 2, "required": 2, "txn": "3SX72816GK5580342", "order": "AC-10054"},
    {"id": "PP-D-8488399", "name": "Chloe Dubois", "email": "chloe.dubois@example.com", "reason": "Item not as described", "amount": 540.00, "status": "lost", "priority": "medium", "open": 23, "due": None, "resolved": 12, "uploaded": 2, "required": 4, "txn": "6KQ04193VD6628175", "order": "AC-10021"},
    {"id": "PP-D-8488140", "name": "Mateo Silva", "email": "mateo.silva@example.com", "reason": "Item not received", "amount": 1275.00, "status": "won", "priority": "high", "open": 44, "due": None, "resolved": 36, "uploaded": 5, "required": 5, "txn": "1RP38570JH1189264", "order": "AC-09987"},
    {"id": "PP-D-8487912", "name": "Hannah Lee", "email": "hannah.lee@example.com", "reason": "Unauthorized transaction", "amount": 365.00, "status": "open", "priority": "medium", "open": 7, "due": 5, "resolved": None, "uploaded": 2, "required": 4, "txn": "5NZ69402CX9917853", "order": "AC-09954"},
    {"id": "PP-D-8487620", "name": "David Osei", "email": "david.osei@example.com", "reason": "Credit not processed", "amount": 82.00, "status": "lost", "priority": "low", "open": 31, "due": None, "resolved": 19, "uploaded": 2, "required": 3, "txn": "0MW21736RT7720481", "order": "AC-09912"},
    {"id": "PP-D-8487355", "name": "Lucia Fernandez", "email": "lucia.fernandez@example.com", "reason": "Item not as described", "amount": 199.00, "status": "won", "priority": "medium", "open": 57, "due": None, "resolved": 48, "uploaded": 4, "required": 4, "txn": "8CJ50381YP3047126", "order": "AC-09868"},
    {"id": "PP-D-8487018", "name": "Tobias Weber", "email": "tobias.weber@example.com", "reason": "Duplicate charge", "amount": 688.00, "status": "open", "priority": "high", "open": 3, "due": 2, "resolved": None, "uploaded": 1, "required": 5, "txn": "2AQ86419LF5583019", "order": "AC-09831"},
    {"id": "PP-D-8486744", "name": "Nina Petrova", "email": "nina.petrova@example.com", "reason": "Subscription canceled", "amount": 24.99, "status": "won", "priority": "low", "open": 85, "due": None, "resolved": 77, "uploaded": 2, "required": 2, "txn": "7ED93528GU6620743", "order": "AC-09790"},
    {"id": "PP-D-8486421", "name": "Arjun Mehta", "email": "arjun.mehta@example.com", "reason": "Item not received", "amount": 455.00, "status": "lost", "priority": "medium", "open": 12, "due": None, "resolved": 4, "uploaded": 3, "required": 4, "txn": "4VS17640KI1185620", "order": "AC-09744"},
    {"id": "PP-D-8485200", "name": "Olivia Brown", "email": "olivia.brown@example.com", "reason": "Item not received", "amount": 320.00, "status": "won", "priority": "medium", "open": 112, "due": None, "resolved": 104, "uploaded": 3, "required": 3, "txn": "9BQ40872OW9913471", "order": "AC-09541"},
    {"id": "PP-D-8484011", "name": "Henry Adams", "email": "henry.adams@example.com", "reason": "Unauthorized transaction", "amount": 890.00, "status": "lost", "priority": "high", "open": 146, "due": None, "resolved": 137, "uploaded": 2, "required": 4, "txn": "3GH72905SZ7725846", "order": "AC-09288"},
]

DEMO_FILES = {
    "Order confirmation": {
        "mime": "application/pdf",
        "size": 188 * KB,
        "name": lambda dispute: f"order-confirmation-{dispute.order_id}.pdf",
        "preview": None,
    },
    "Proof of delivery": {
        "mime": "image/svg+xml",
        "size": 1240 * KB,
        "name": lambda dispute: f"proof-of-delivery-{dispute.order_id}.svg",
        "preview": "/evidence/proof-of-delivery.svg",
    },
    "Customer communication": {
        "mime": "image/svg+xml",
        "size": 640 * KB,
        "name": lambda dispute: f"buyer-conversation-{dispute.order_id}.svg",
        "preview": "/evidence/customer-thread.svg",
    },
    "Refund & cancellation policy": {
        "mime": "application/pdf",
        "size": 96 * KB,
        "name": lambda dispute: "refund-cancellation-policy.pdf",
        "preview": None,
    },
    "Transaction verification": {
        "mime": "application/pdf",
        "size": 214 * KB,
        "name": lambda dispute: f"transaction-verification-{dispute.transaction_id}.pdf",
        "preview": None,
    },
}


def seed_demo_data(db: Session, settings: Settings) -> None:
    existing = db.scalar(select(func.count()).select_from(User))
    if existing:
        return

    now = utcnow()
    merchant = User(
        email=DEMO_EMAIL,
        name="Demo Merchant",
        business_name="Acme Commerce",
        password_hash=hash_password(DEMO_PASSWORD),
        created_at=now - timedelta(days=365),
    )
    db.add(merchant)
    db.flush()

    for index, row in enumerate(DEMO_DISPUTES):
        opened_at = now - timedelta(days=row["open"])
        due_at = (
            now + timedelta(days=row["due"]) if row["due"] is not None else None
        )
        resolved_at = (
            now - timedelta(days=row["resolved"])
            if row["resolved"] is not None
            else None
        )

        dispute = Dispute(
            id=row["id"],
            merchant_id=merchant.id,
            transaction_id=row["txn"],
            order_id=row["order"],
            buyer_name=row["name"],
            buyer_email=row["email"],
            reason=row["reason"],
            amount=row["amount"],
            currency="USD",
            status=row["status"],
            priority=row["priority"],
            required_evidence=row["required"],
            opened_at=opened_at,
            due_at=due_at,
            resolved_at=resolved_at,
            created_at=opened_at,
            updated_at=opened_at,
        )

        order = case_context.order_details(dispute)
        transaction = Transaction(
            id=row["txn"],
            merchant_id=merchant.id,
            order_id=row["order"],
            buyer_name=row["name"],
            buyer_email=row["email"],
            amount=row["amount"],
            currency="USD",
            status="completed",
            payment_method=order["payment_method"],
            items=order["items"],
            shipping_address=order["shipping_address"],
            created_at=from_ms(order["placed_at"]),
        )
        db.add(transaction)
        db.flush()
        db.add(dispute)

        required_types = required_types_for(dispute)
        for evidence_index, evidence_type in enumerate(
            required_types[: row["uploaded"]]
        ):
            meta = DEMO_FILES[evidence_type]
            db.add(
                EvidenceFile(
                    id=f"seed-{dispute.id}-{evidence_index}",
                    dispute_id=dispute.id,
                    evidence_type=evidence_type,
                    file_name=meta["name"](dispute),
                    mime_type=meta["mime"],
                    size_bytes=meta["size"],
                    storage_path=None,
                    preview_url=meta["preview"],
                    source="demo",
                    status="ready",
                    extraction_status="demo",
                    extracted_fields={},
                    quality_score=60,
                    uploaded_at=opened_at
                    - timedelta(days=row["uploaded"] - evidence_index),
                )
            )

        if index == len(DEMO_DISPUTES) - 1:
            db.commit()
        else:
            db.flush()

    db.commit()

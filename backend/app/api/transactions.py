from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.timeutils import to_ms
from app.models.dispute import Dispute
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionListResponse, TransactionOut
from app.services import case_context
from app.services.dispute_service import evidence_summary

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _serialize_transaction(
    transaction: Transaction, dispute: Dispute | None
) -> dict:
    tracking = None
    if dispute is not None:
        uploaded = evidence_summary(dispute)["uploaded"]
        tracking = case_context.tracking_info(dispute, uploaded)

    return {
        "id": transaction.id,
        "order_id": transaction.order_id,
        "dispute_id": dispute.id if dispute else None,
        "buyer_name": transaction.buyer_name,
        "buyer_email": transaction.buyer_email,
        "amount": float(transaction.amount),
        "currency": transaction.currency,
        "status": transaction.status,
        "payment_method": transaction.payment_method,
        "items": transaction.items or [],
        "shipping_address": transaction.shipping_address or {},
        "created_at": to_ms(transaction.created_at),
        "tracking": tracking,
    }


@router.get("", response_model=TransactionListResponse)
def list_transactions(
    q: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    filters = [Transaction.merchant_id == user.id]
    if q:
        needle = f"%{q.strip().lower()}%"
        filters.append(
            func.lower(Transaction.id).like(needle)
            | func.lower(Transaction.order_id).like(needle)
            | func.lower(Transaction.buyer_name).like(needle)
            | func.lower(Transaction.buyer_email).like(needle)
        )

    total = db.scalar(select(func.count()).select_from(Transaction).where(*filters)) or 0
    transactions = list(
        db.scalars(
            select(Transaction)
            .where(*filters)
            .order_by(Transaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )

    disputes = {
        dispute.transaction_id: dispute
        for dispute in db.scalars(
            select(Dispute).where(
                Dispute.merchant_id == user.id,
                Dispute.transaction_id.in_(
                    [transaction.id for transaction in transactions] or [""]
                ),
            )
        ).all()
    }

    return {
        "items": [
            _serialize_transaction(transaction, disputes.get(transaction.id))
            for transaction in transactions
        ],
        "total": total,
    }


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    transaction = db.scalars(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.merchant_id == user.id,
        )
    ).first()
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found."
        )

    dispute = db.scalars(
        select(Dispute).where(
            Dispute.transaction_id == transaction.id,
            Dispute.merchant_id == user.id,
        )
    ).first()
    return _serialize_transaction(transaction, dispute)

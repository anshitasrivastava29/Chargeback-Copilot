from fastapi import APIRouter

from app.api import (
    auth,
    dashboard,
    disputes,
    evidence,
    health,
    paypal,
    reports,
    settings,
    transactions,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(disputes.router)
api_router.include_router(evidence.dispute_router)
api_router.include_router(evidence.router)
api_router.include_router(dashboard.router)
api_router.include_router(reports.router)
api_router.include_router(settings.router)
api_router.include_router(transactions.router)
api_router.include_router(paypal.router)

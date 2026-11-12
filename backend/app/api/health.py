import logging

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.observability import get_request_id

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])


@router.get("/health")
def health(request: Request):
    settings = request.app.state.settings
    database = "ok"

    try:
        with request.app.state.session_factory() as db:
            db.execute(text("SELECT 1"))
    except Exception:
        database = "error"
        logger.exception("Health check database probe failed.")

    payload = {
        "status": "ok" if database == "ok" else "degraded",
        "service": settings.app_name,
        "environment": settings.environment,
        "database": database,
        "aiMode": settings.ai_mode,
        "llmConfigured": bool(settings.llm_api_key),
        "requestId": get_request_id(request),
    }

    if database != "ok":
        return JSONResponse(status_code=503, content=payload)
    return payload

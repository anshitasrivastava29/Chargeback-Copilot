from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services.ai.engine import DisputeIntelligenceEngine
from app.services.paypal import PayPalClient

bearer_scheme = HTTPBearer(auto_error=False)


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_intelligence(request: Request) -> DisputeIntelligenceEngine:
    return request.app.state.intelligence


def get_paypal_client(request: Request) -> PayPalClient:
    return request.app.state.paypal_client


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    settings: Settings = request.app.state.settings

    if credentials is not None:
        payload = decode_access_token(credentials.credentials, settings)
        if payload is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = db.get(User, int(payload.get("sub", 0)))
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account no longer exists.",
            )
        return user

    if settings.require_auth:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    demo_user = db.scalars(select(User).order_by(User.id)).first()
    if demo_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No merchant workspace is available.",
        )
    return demo_user

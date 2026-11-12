import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.database import (
    build_engine,
    build_session_factory,
    init_database,
)
from app.core.observability import RequestContextMiddleware, RequestSizeLimitMiddleware
from app.services.ai.engine import DisputeIntelligenceEngine
from app.services.paypal import PayPalClient
from app.services.seed import seed_demo_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

DEFAULT_JWT_SECRET = "dev-only-secret-change-me-in-production-32bytes-min"


def _log_configuration_warnings(settings: Settings) -> None:
    production = settings.environment.strip().lower() in {"production", "prod"}

    if settings.jwt_secret == DEFAULT_JWT_SECRET or len(settings.jwt_secret) < 32:
        logger.warning(
            "JWT_SECRET is the development default or shorter than 32 characters. "
            "Set a random 32+ character secret before exposing this API."
        )

    if production and not settings.require_auth:
        logger.warning(
            "ENVIRONMENT=%s but REQUIRE_AUTH is false. Unauthenticated requests "
            "are served as the demo merchant. Set REQUIRE_AUTH=true outside the demo.",
            settings.environment,
        )

    if "*" in settings.cors_origin_list:
        logger.warning(
            "CORS_ORIGINS contains '*'. Restrict it to the deployed frontend origin."
        )

    if settings.paypal_configured and not settings.paypal_token_encryption_key:
        logger.warning(
            "PAYPAL_TOKEN_ENCRYPTION_KEY is empty; stored PayPal tokens use a key "
            "derived from JWT_SECRET. Set an explicit Fernet key in production."
        )


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    _log_configuration_warnings(settings)

    engine = build_engine(settings.database_url)
    session_factory = build_session_factory(engine)
    init_database(engine)
    logger.info("Using %s database", engine.dialect.name)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.seed_demo_data:
            with session_factory() as db:
                seed_demo_data(db, settings)
            logger.info("Demo workspace is ready.")
        yield

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "Backend for Chargeback Copilot: PayPal dispute workflow, evidence "
            "intelligence, risk scoring, and AI response drafting."
        ),
        lifespan=lifespan,
    )

    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.intelligence = DisputeIntelligenceEngine(settings)
    app.state.paypal_client = PayPalClient(settings)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    # Added after CORS so it is the outermost layer: every response, including
    # CORS preflights and size-limit rejections, carries a request id.
    app.add_middleware(
        RequestSizeLimitMiddleware,
        max_bytes=settings.max_request_bytes,
        max_mb=settings.max_request_mb,
    )
    app.add_middleware(
        RequestContextMiddleware,
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/", tags=["system"])
    def index():
        return {
            "service": settings.app_name,
            "version": "0.1.0",
            "docs": "/docs",
            "health": f"{settings.api_prefix}/health",
        }

    return app


app = create_app()

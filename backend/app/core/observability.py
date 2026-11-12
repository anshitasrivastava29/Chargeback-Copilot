import logging
import time
import uuid

from starlette.datastructures import Headers
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger("app.request")

REQUEST_ID_HEADER = "X-Request-ID"


def get_request_id(request) -> str | None:
    """Return the correlation id assigned to the current request."""
    return getattr(request.state, "request_id", None)


class RequestContextMiddleware:
    """Assign a request id and emit one structured log line per request.

    Implemented as pure ASGI middleware so streaming responses (evidence
    downloads) and background exceptions are not buffered.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        request_id = headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id

        status_code = 500
        started = time.perf_counter()

        async def send_with_request_id(message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                raw_headers = list(message.get("headers", []))
                raw_headers.append(
                    (REQUEST_ID_HEADER.lower().encode("latin-1"), request_id.encode("latin-1"))
                )
                message["headers"] = raw_headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "request.failed request_id=%s method=%s path=%s duration_ms=%.1f",
                request_id,
                scope.get("method"),
                scope.get("path"),
                duration_ms,
            )
            raise
        else:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "request.completed request_id=%s method=%s path=%s status=%s duration_ms=%.1f",
                request_id,
                scope.get("method"),
                scope.get("path"),
                status_code,
                duration_ms,
            )


class RequestSizeLimitMiddleware:
    """Reject oversized requests from ``Content-Length`` before body parsing.

    This is the coarse proxy-style guard; ``MAX_UPLOAD_MB`` remains the
    authoritative per-file check inside the evidence service.
    """

    def __init__(self, app: ASGIApp, max_bytes: int, max_mb: int):
        self.app = app
        self.max_bytes = max_bytes
        self.max_mb = max_mb

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and self.max_bytes >= 0:
            headers = Headers(scope=scope)
            raw_length = headers.get("content-length")
            if raw_length:
                try:
                    content_length = int(raw_length)
                except ValueError:
                    content_length = 0
                if content_length > self.max_bytes:
                    response = JSONResponse(
                        status_code=413,
                        content={
                            "detail": (
                                f"Request body exceeds the {self.max_mb} MB limit."
                            )
                        },
                    )
                    await response(scope, receive, send)
                    return

        await self.app(scope, receive, send)

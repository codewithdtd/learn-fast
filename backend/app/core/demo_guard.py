"""Demo Guard Middleware

Intercepts database modification requests when DEMO_MODE=true is configured.
Allows read-only queries (GET) and non-destructive demo study interactions,
while blocking destructive actions (workbook import, delete, rename, register).
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import settings


# Endpoints that are blocked when demo_mode is active
BLOCKED_PATTERNS = [
    ("POST", "/api/v1/workbooks/import"),
    ("DELETE", "/api/v1/workbooks"),
    ("PATCH", "/api/v1/workbooks"),
    ("POST", "/api/v1/auth/register"),
    ("POST", "/api/v1/auth/change-password"),
]


class DemoReadOnlyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if settings.demo_mode:
            method = request.method.upper()
            path = request.url.path

            for blocked_method, blocked_path in BLOCKED_PATTERNS:
                if method == blocked_method and path.startswith(blocked_path):
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={
                            "detail": "Demo Mode is enabled for portfolio showcase. Data modifications (create/update/delete) are temporarily disabled to preserve sample data. Please contact admin if you need a full sandbox."
                        },
                    )

        return await call_next(request)

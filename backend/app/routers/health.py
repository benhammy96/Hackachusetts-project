"""Health and metadata endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, object]:
    """Liveness and readiness probe.

    Reports core app metadata plus whether live AI (Claude) is configured, so
    the frontend and demo can show whether explanations are model-generated or
    the offline fallback.
    """
    settings = get_settings()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": __version__,
        "environment": settings.environment,
        "ai": {
            "enabled": settings.ai_enabled,
            "model": settings.anthropic_model if settings.ai_enabled else "offline-placeholder",
        },
    }

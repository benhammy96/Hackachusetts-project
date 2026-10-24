"""Health and metadata endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe."""
    settings = get_settings()
    return {"status": "ok", "app": settings.app_name, "environment": settings.environment}

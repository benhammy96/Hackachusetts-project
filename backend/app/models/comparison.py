"""Models for comparing multiple candidate sites."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.site import SiteScore


class ComparisonRequest(BaseModel):
    """Request a ranked comparison of previously scored sites."""

    scores: list[SiteScore] = Field(..., min_length=2, description="At least two sites to compare")


class ComparisonResponse(BaseModel):
    """A ranked comparison result."""

    ranked_site_ids: list[str] = Field(..., description="Site ids ordered best to worst")
    best_site_id: str
    notes: str | None = None

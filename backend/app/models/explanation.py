"""Models for AI-generated suitability explanations."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.site import SiteScore


class ExplanationRequest(BaseModel):
    """Request an AI explanation for a computed site score."""

    site_name: str
    score: SiteScore
    audience: str = Field(
        default="general",
        description="Target audience, e.g. 'general', 'engineer', 'community'",
    )


class ExplanationResponse(BaseModel):
    """An AI-generated, human-readable explanation of a site's score."""

    site_id: str
    summary: str = Field(..., description="Short plain-language summary of the score")
    details: str = Field(..., description="Longer narrative covering each category")
    model: str = Field(..., description="Identifier of the model that produced the text")

"""Shared Pydantic data models for the Atlas API."""

from app.models.site import (
    Coordinates,
    ScoreBreakdown,
    ScoreCategory,
    SiteCandidate,
    SiteScore,
    SiteScoreRequest,
)
from app.models.explanation import ExplanationRequest, ExplanationResponse
from app.models.comparison import ComparisonRequest, ComparisonResponse

__all__ = [
    "Coordinates",
    "ScoreBreakdown",
    "ScoreCategory",
    "SiteCandidate",
    "SiteScore",
    "SiteScoreRequest",
    "ExplanationRequest",
    "ExplanationResponse",
    "ComparisonRequest",
    "ComparisonResponse",
]

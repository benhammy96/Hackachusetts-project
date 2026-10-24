"""Core domain models for site candidates and their suitability scores.

The weighted scoring system evaluates five categories. The default weights are
defined here so frontend and backend stay in sync:

    community       25%
    energy          25%
    environmental   20%
    infrastructure  15%
    land            15%
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class ScoreCategory(str, Enum):
    """The five weighted scoring dimensions for a data center site."""

    COMMUNITY = "community"
    ENERGY = "energy"
    ENVIRONMENTAL = "environmental"
    INFRASTRUCTURE = "infrastructure"
    LAND = "land"


# Default category weights. Must sum to 1.0.
DEFAULT_WEIGHTS: dict[ScoreCategory, float] = {
    ScoreCategory.COMMUNITY: 0.25,
    ScoreCategory.ENERGY: 0.25,
    ScoreCategory.ENVIRONMENTAL: 0.20,
    ScoreCategory.INFRASTRUCTURE: 0.15,
    ScoreCategory.LAND: 0.15,
}


class Coordinates(BaseModel):
    """A WGS84 latitude/longitude pair."""

    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    lng: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")


class SiteCandidate(BaseModel):
    """A user-selected potential data center location."""

    id: str = Field(..., description="Stable client-generated identifier")
    name: str = Field(..., description="Human-readable label for the candidate")
    coordinates: Coordinates
    notes: str | None = Field(default=None, description="Optional free-form notes")


class ScoreBreakdown(BaseModel):
    """A single category's score with its weight and contribution."""

    category: ScoreCategory
    raw_score: float = Field(..., ge=0.0, le=100.0, description="Unweighted score, 0-100")
    weight: float = Field(..., ge=0.0, le=1.0, description="Weight applied to this category")
    weighted_score: float = Field(..., ge=0.0, le=100.0, description="raw_score * weight")


class SiteScore(BaseModel):
    """The full scoring result for a single site candidate."""

    site_id: str
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Weighted total, 0-100")
    breakdown: list[ScoreBreakdown]


class SiteScoreRequest(BaseModel):
    """Request body for scoring one or more candidate sites.

    Optionally override the default category weights. When provided, weights
    are normalized to sum to 1.0 by the scoring service.
    """

    candidates: list[SiteCandidate]
    weights: dict[ScoreCategory, float] | None = Field(
        default=None,
        description="Optional category weight overrides (normalized server-side)",
    )

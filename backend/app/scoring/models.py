"""Output models for the scoring engine.

These extend what the shared ``app.models.site`` provides. The shared
``SiteScore``/``ScoreBreakdown`` describe the minimal API-facing shape; scoring
needs to additionally report data completeness, which inputs were missing,
non-fatal warnings, and any verified disqualifying constraints (kept *separate*
from the numeric score). We expose a richer :class:`SuitabilityResult` and a
``to_site_score()`` adapter so the existing API contract still works.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.site import ScoreBreakdown, ScoreCategory, SiteScore


class CategoryResult(BaseModel):
    """Scoring outcome for a single category."""

    category: ScoreCategory
    score: float = Field(..., ge=0.0, le=100.0, description="Category score, 0-100")
    weight: float = Field(..., ge=0.0, le=1.0, description="Normalized weight applied")
    weighted_score: float = Field(..., ge=0.0, le=100.0)
    completeness: float = Field(
        ..., ge=0.0, le=1.0, description="Fraction of this category's inputs that were available"
    )
    used_metrics: list[str] = Field(default_factory=list)
    missing_metrics: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class DisqualifyingConstraint(BaseModel):
    """A verified screening constraint that flags a site, separate from the score.

    Only raised from *verified* data (never from missing/assumed values). These
    are screening assumptions for shortlisting, not regulatory determinations.
    """

    code: str = Field(..., description="Stable machine code, e.g. 'in_sfha'")
    message: str
    category: ScoreCategory


class SuitabilityResult(BaseModel):
    """The full scoring result for one location."""

    site_id: str | None = None
    overall_score: float = Field(..., ge=0.0, le=100.0)
    categories: list[CategoryResult]
    data_completeness: float = Field(
        ..., ge=0.0, le=1.0, description="Overall fraction of expected inputs available"
    )
    missing_metrics: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    disqualifying_constraints: list[DisqualifyingConstraint] = Field(default_factory=list)
    is_disqualified: bool = Field(
        default=False, description="True if any verified disqualifying constraint applies"
    )

    def to_site_score(self, site_id: str | None = None) -> SiteScore:
        """Adapt to the shared API-facing ``SiteScore`` model.

        Lets the backend return scoring results through the existing
        ``/sites/score`` contract without a breaking change.
        """
        breakdown = [
            ScoreBreakdown(
                category=c.category,
                raw_score=c.score,
                weight=c.weight,
                weighted_score=c.weighted_score,
            )
            for c in self.categories
        ]
        return SiteScore(
            site_id=site_id or self.site_id or "unknown",
            overall_score=self.overall_score,
            breakdown=breakdown,
        )

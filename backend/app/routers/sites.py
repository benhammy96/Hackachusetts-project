"""Site scoring and comparison endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.comparison import ComparisonRequest, ComparisonResponse
from app.models.site import SiteScore, SiteScoreRequest
from app.services import scoring

router = APIRouter(prefix="/sites", tags=["sites"])


@router.post("/score", response_model=list[SiteScore])
async def score_sites(request: SiteScoreRequest) -> list[SiteScore]:
    """Score one or more candidate sites using the weighted model."""
    return scoring.score_candidates(request.candidates, request.weights)


@router.post("/compare", response_model=ComparisonResponse)
async def compare_sites(request: ComparisonRequest) -> ComparisonResponse:
    """Rank previously scored sites from best to worst."""
    ranked = sorted(request.scores, key=lambda s: s.overall_score, reverse=True)
    ranked_ids = [s.site_id for s in ranked]
    return ComparisonResponse(
        ranked_site_ids=ranked_ids,
        best_site_id=ranked_ids[0],
        notes="Ranked by overall weighted score.",
    )

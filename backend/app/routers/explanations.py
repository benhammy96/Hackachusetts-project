"""AI explanation endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.models.explanation import ExplanationRequest, ExplanationResponse
from app.services import ai

router = APIRouter(prefix="/explanations", tags=["explanations"])


@router.post("", response_model=ExplanationResponse)
async def explain_score(request: ExplanationRequest) -> ExplanationResponse:
    """Generate an AI explanation of a site's suitability score."""
    return ai.generate_explanation(request)

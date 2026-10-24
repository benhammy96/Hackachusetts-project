"""AI explanation service backed by the Claude API.

Placeholder implementation. When no API key is configured (local dev without
credentials) it falls back to a deterministic, offline explanation so the rest
of the app remains runnable. The AI teammate will flesh out the prompt design.
"""

from __future__ import annotations

from app.config import get_settings
from app.models.explanation import ExplanationRequest, ExplanationResponse


def _offline_explanation(request: ExplanationRequest) -> ExplanationResponse:
    """Build a simple explanation without calling the Claude API."""
    top = sorted(request.score.breakdown, key=lambda b: b.weighted_score, reverse=True)
    best = top[0].category.value if top else "unknown"
    worst = top[-1].category.value if top else "unknown"

    summary = (
        f"{request.site_name} scores {request.score.overall_score:.1f}/100 overall, "
        f"with {best} as its strongest factor."
    )
    details = (
        f"The site's overall suitability is {request.score.overall_score:.1f}. "
        f"Its strongest category is {best} and its weakest is {worst}. "
        "This is an offline placeholder explanation; configure ANTHROPIC_API_KEY "
        "to generate richer, model-written narratives."
    )
    return ExplanationResponse(
        site_id=request.score.site_id,
        summary=summary,
        details=details,
        model="offline-placeholder",
    )


def generate_explanation(request: ExplanationRequest) -> ExplanationResponse:
    """Generate a human-readable explanation of a site score.

    TODO(ai): call the Claude Messages API using ``settings.anthropic_model``
    and a well-designed prompt. For now we return an offline placeholder unless
    extended.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return _offline_explanation(request)

    # TODO(ai): implement real Claude call. Falling back to offline for now to
    # keep the scaffold runnable without network access.
    return _offline_explanation(request)

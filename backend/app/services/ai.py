"""AI explanation service backed by the Claude API.

This service turns a computed :class:`SiteScore` into a human-readable
explanation. When an Anthropic API key is configured it calls the Claude
Messages API; otherwise (local dev without credentials, or if the call fails)
it falls back to a deterministic, offline explanation so the rest of the app
always remains runnable and demoable.

Design notes
------------
* The public surface (:func:`generate_explanation`) is synchronous and never
  raises for expected failure modes (missing key, network error, API error).
  It degrades to the offline explanation instead, so the ``/explanations``
  endpoint cannot 500 because of the AI provider.
* Prompt construction is isolated in :func:`_build_prompt` so the AI teammate
  can iterate on wording without touching transport or fallback logic.
"""

from __future__ import annotations

import logging

from app.config import get_settings
from app.models.explanation import ExplanationRequest, ExplanationResponse
from app.models.site import SiteScore

logger = logging.getLogger("atlas.ai")

# Keep the model's narrative focused and demo-friendly.
_MAX_TOKENS = 700

_AUDIENCE_GUIDANCE = {
    "general": "a general audience with no technical background",
    "engineer": "a data center infrastructure engineer who wants specifics",
    "community": "local community members concerned about local impact",
    "investor": "an investor evaluating the business case",
}


def _format_breakdown(score: SiteScore) -> str:
    """Render the per-category breakdown as compact, model-friendly text."""
    lines = []
    for item in sorted(score.breakdown, key=lambda b: b.weighted_score, reverse=True):
        lines.append(
            f"- {item.category.value}: raw {item.raw_score:.1f}/100, "
            f"weight {item.weight:.0%}, contributes {item.weighted_score:.1f} points"
        )
    return "\n".join(lines)


def _build_prompt(request: ExplanationRequest) -> str:
    """Construct the user prompt sent to Claude."""
    audience = _AUDIENCE_GUIDANCE.get(
        request.audience.lower(), _AUDIENCE_GUIDANCE["general"]
    )
    breakdown = _format_breakdown(request.score)
    return (
        f"A data center site called \"{request.site_name}\" received an overall "
        f"suitability score of {request.score.overall_score:.1f} out of 100.\n\n"
        f"Category breakdown (higher weighted contribution = more influence on the "
        f"overall score):\n{breakdown}\n\n"
        f"Explain this score for {audience}. "
        "Cover: (1) a one-sentence verdict, (2) the strongest factors and why they "
        "help, (3) the weakest factors and the risk they introduce, and "
        "(4) one concrete suggestion for due diligence. "
        "Be specific, factual, and concise. Do not invent data not implied by the "
        "scores above."
    )


_SYSTEM_PROMPT = (
    "You are Atlas, an assistant that explains data center site suitability "
    "scores clearly and honestly. You never fabricate figures; you reason only "
    "from the category scores and weights you are given. Keep explanations "
    "grounded, balanced, and free of hype."
)


def _split_summary_details(text: str) -> tuple[str, str]:
    """Split model output into a short summary and the full details.

    The summary is the first non-empty line/sentence; details is the full text.
    This keeps the response shape stable regardless of how the model formats.
    """
    cleaned = text.strip()
    if not cleaned:
        return ("", "")
    # First paragraph (or first sentence if it's one block) becomes the summary.
    first_block = cleaned.split("\n\n", 1)[0].strip()
    first_sentence = first_block.split(". ", 1)[0].strip()
    summary = first_sentence if first_sentence.endswith(".") else first_sentence + "."
    return (summary, cleaned)


def _offline_explanation(
    request: ExplanationRequest, *, reason: str | None = None
) -> ExplanationResponse:
    """Build a deterministic explanation without calling the Claude API."""
    ordered = sorted(
        request.score.breakdown, key=lambda b: b.weighted_score, reverse=True
    )
    best = ordered[0].category.value if ordered else "unknown"
    worst = ordered[-1].category.value if ordered else "unknown"
    overall = request.score.overall_score

    verdict = "strong" if overall >= 70 else "moderate" if overall >= 45 else "weak"

    summary = (
        f"{request.site_name} is a {verdict} candidate at {overall:.1f}/100, "
        f"strongest on {best} and weakest on {worst}."
    )
    details = (
        f"{request.site_name} earns an overall suitability score of {overall:.1f} "
        f"out of 100, making it a {verdict} candidate. Its leading strength is "
        f"{best}, which contributes the most weighted points, while {worst} is the "
        f"limiting factor and the area to scrutinize during due diligence. "
        "This is a deterministic offline explanation; set ANTHROPIC_API_KEY to "
        "generate a richer, model-written narrative."
    )
    if reason:
        logger.info("Serving offline explanation (%s)", reason)
    return ExplanationResponse(
        site_id=request.score.site_id,
        summary=summary,
        details=details,
        model="offline-placeholder",
    )


def _claude_explanation(request: ExplanationRequest) -> ExplanationResponse | None:
    """Call the Claude Messages API. Return ``None`` on any failure.

    Returning ``None`` lets the caller fall back to the offline explanation so
    the endpoint never fails because of the AI provider.
    """
    settings = get_settings()
    try:
        # Imported lazily so the package is only required when a key is set.
        from anthropic import Anthropic
    except ImportError:
        logger.warning("anthropic package not installed; using offline explanation")
        return None

    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=_MAX_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _build_prompt(request)}],
        )
        text = "".join(
            block.text for block in message.content if getattr(block, "type", None) == "text"
        ).strip()
        if not text:
            logger.warning("Claude returned empty content; using offline explanation")
            return None

        summary, details = _split_summary_details(text)
        return ExplanationResponse(
            site_id=request.score.site_id,
            summary=summary,
            details=details,
            model=settings.anthropic_model,
        )
    except Exception as exc:  # noqa: BLE001 - degrade gracefully on any provider error
        logger.warning("Claude call failed (%s); using offline explanation", exc)
        return None


def generate_explanation(request: ExplanationRequest) -> ExplanationResponse:
    """Generate a human-readable explanation of a site score.

    Calls Claude when a key is configured and the call succeeds; otherwise
    returns a deterministic offline explanation. Never raises for expected
    provider failure modes.
    """
    settings = get_settings()
    if not settings.anthropic_api_key:
        return _offline_explanation(request, reason="no API key configured")

    result = _claude_explanation(request)
    if result is not None:
        return result
    return _offline_explanation(request, reason="Claude unavailable")

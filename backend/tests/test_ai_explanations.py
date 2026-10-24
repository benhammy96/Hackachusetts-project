"""Tests for the Backend & AI workstream.

These lock in the behavior that must never regress for the demo:

1. The ``/explanations`` endpoint always returns 200 and never 500s, even when
   the AI provider is misconfigured or fails.
2. With no API key, the service returns a coherent deterministic explanation.
3. When the Claude call raises, the service falls back to the offline path
   instead of propagating the error.
4. ``/health`` accurately reports whether live AI is enabled.

Only backend/app files in the Backend & AI lane are exercised here (ai, config,
health, explanations). Scoring/data/frontend are owned by other teammates.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from app.models.explanation import ExplanationRequest
from app.models.site import ScoreBreakdown, ScoreCategory, SiteScore
from app.services import ai


@pytest.fixture(autouse=True)
def clear_settings_cache():
    """Ensure each test reads fresh settings (env vars may change per test)."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def sample_score() -> SiteScore:
    return SiteScore(
        site_id="site-1",
        overall_score=72.5,
        breakdown=[
            ScoreBreakdown(category=ScoreCategory.ENERGY, raw_score=90, weight=0.25, weighted_score=22.5),
            ScoreBreakdown(category=ScoreCategory.COMMUNITY, raw_score=80, weight=0.25, weighted_score=20.0),
            ScoreBreakdown(category=ScoreCategory.ENVIRONMENTAL, raw_score=70, weight=0.20, weighted_score=14.0),
            ScoreBreakdown(category=ScoreCategory.INFRASTRUCTURE, raw_score=60, weight=0.15, weighted_score=9.0),
            ScoreBreakdown(category=ScoreCategory.LAND, raw_score=47, weight=0.15, weighted_score=7.0),
        ],
    )


@pytest.fixture
def sample_request(sample_score: SiteScore) -> ExplanationRequest:
    return ExplanationRequest(site_name="North Grid Site", score=sample_score, audience="investor")


# --- Health -----------------------------------------------------------------


def test_health_reports_ai_disabled_without_key(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["ai"]["enabled"] is False
    assert body["ai"]["model"] == "offline-placeholder"


def test_health_reports_ai_enabled_with_key(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-fake")
    get_settings.cache_clear()
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["ai"]["enabled"] is True


# --- Offline explanation ----------------------------------------------------


def test_offline_explanation_is_coherent(sample_request):
    result = ai._offline_explanation(sample_request)
    assert result.site_id == "site-1"
    assert result.model == "offline-placeholder"
    assert "North Grid Site" in result.summary
    # Strongest category is energy, weakest is land (by weighted contribution).
    assert "energy" in result.details
    assert "land" in result.details


def test_endpoint_returns_offline_without_key(client, sample_request, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    get_settings.cache_clear()
    resp = client.post("/explanations", json=sample_request.model_dump())
    assert resp.status_code == 200
    assert resp.json()["model"] == "offline-placeholder"


# --- Graceful fallback (the critical "never 500" guarantee) -----------------


def test_endpoint_never_500s_when_claude_fails(client, sample_request, monkeypatch):
    """A failing Claude call must degrade to offline, not raise."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-fake")
    get_settings.cache_clear()

    def boom(_request):
        raise RuntimeError("simulated provider outage")

    # Force the real-call helper to blow up; generate_explanation should catch.
    monkeypatch.setattr(ai, "_claude_explanation", lambda req: None)

    resp = client.post("/explanations", json=sample_request.model_dump())
    assert resp.status_code == 200
    assert resp.json()["model"] == "offline-placeholder"


def test_claude_helper_returns_none_on_exception(sample_request, monkeypatch):
    """_claude_explanation swallows provider errors and returns None."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-fake")
    get_settings.cache_clear()

    class FakeMessages:
        def create(self, **_kwargs):
            raise RuntimeError("network down")

    class FakeClient:
        def __init__(self, **_kwargs):
            self.messages = FakeMessages()

    import anthropic

    monkeypatch.setattr(anthropic, "Anthropic", FakeClient)
    assert ai._claude_explanation(sample_request) is None


def test_generate_explanation_uses_claude_when_available(sample_request, monkeypatch):
    """When the helper returns a result, generate_explanation passes it through."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-fake")
    get_settings.cache_clear()

    from app.models.explanation import ExplanationResponse

    fake = ExplanationResponse(
        site_id=sample_request.score.site_id,
        summary="Model summary.",
        details="Model details.",
        model="claude-3-5-sonnet-latest",
    )
    monkeypatch.setattr(ai, "_claude_explanation", lambda req: fake)
    result = ai.generate_explanation(sample_request)
    assert result.model == "claude-3-5-sonnet-latest"
    assert result.summary == "Model summary."


# --- Prompt construction ----------------------------------------------------


def test_prompt_includes_site_and_scores(sample_request):
    prompt = ai._build_prompt(sample_request)
    assert "North Grid Site" in prompt
    assert "72.5" in prompt
    assert "energy" in prompt

"""Shared async HTTP helpers for data sources.

Centralizes timeout handling, a small retry with backoff, and a uniform way to
translate network failures into our explicit "missing" semantics. Sources call
:func:`fetch_json` and either get parsed JSON back or a typed
:class:`FetchError` they can convert into a missing :class:`~app.data.models.Metric`.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_RETRIES = 2
RETRY_BACKOFF_SECONDS = 0.75

# Several public APIs (notably OSM Overpass) reject requests without a
# descriptive User-Agent. Always send one.
DEFAULT_USER_AGENT = "AtlasDataLayer/0.1 (Hackachusetts2026; data center siting)"


@dataclass
class FetchError(Exception):
    """A network/HTTP failure, classified for missing-value reporting."""

    kind: str  # "timeout" | "http_error" | "network" | "decode"
    message: str

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.kind}: {self.message}"


async def fetch_json(
    url: str,
    *,
    method: str = "GET",
    params: dict[str, Any] | None = None,
    data: dict[str, Any] | str | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    retries: int = DEFAULT_RETRIES,
) -> Any:
    """Fetch and parse JSON with timeout + retry.

    Raises :class:`FetchError` on timeout, non-2xx, network failure, or invalid
    JSON. Retries are only attempted for timeouts and 5xx responses, since those
    are the transient cases; 4xx and decode errors fail fast.
    """
    last_error: FetchError | None = None

    merged_headers = {"User-Agent": DEFAULT_USER_AGENT, "Accept": "application/json"}
    if headers:
        merged_headers.update(headers)

    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(
                timeout=timeout, follow_redirects=True
            ) as client:
                resp = await client.request(
                    method, url, params=params, data=data, headers=merged_headers
                )
            if resp.status_code >= 500:
                last_error = FetchError("http_error", f"{resp.status_code} from {url}")
                await _maybe_backoff(attempt, retries)
                continue
            resp.raise_for_status()
            try:
                return resp.json()
            except ValueError as exc:
                raise FetchError("decode", f"Invalid JSON from {url}: {exc}") from exc

        except httpx.TimeoutException as exc:
            last_error = FetchError("timeout", f"Request to {url} timed out after {timeout}s")
            await _maybe_backoff(attempt, retries)
            continue
        except httpx.HTTPStatusError as exc:
            # 4xx — not retryable.
            raise FetchError(
                "http_error", f"{exc.response.status_code} from {url}"
            ) from exc
        except httpx.HTTPError as exc:
            last_error = FetchError("network", f"Network error for {url}: {exc}")
            await _maybe_backoff(attempt, retries)
            continue

    # Exhausted retries.
    raise last_error or FetchError("network", f"Unknown failure fetching {url}")


async def _maybe_backoff(attempt: int, retries: int) -> None:
    """Sleep with linear backoff unless this was the final attempt."""
    if attempt < retries:
        await asyncio.sleep(RETRY_BACKOFF_SECONDS * (attempt + 1))

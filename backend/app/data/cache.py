"""Lightweight TTL cache for external data responses.

Two layers:

* An in-process dict for the lifetime of the server.
* An optional on-disk JSON store under ``.cache/`` so repeated demo runs (and
  development restarts) don't re-hit rate-limited public APIs.

Keys are built from a logical namespace plus the *rounded* coordinate, so
nearby clicks reuse the same cached answer (external datasets don't change at
sub-~100m resolution for our purposes). Rounding precision is configurable.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

# Default: ~3 decimal places of lat/lng ≈ 110m grid. Good enough to dedupe
# clicks while staying location-specific.
DEFAULT_COORD_PRECISION = 3
DEFAULT_TTL_SECONDS = 60 * 60 * 24  # 24h; external datasets are slow-moving.

_CACHE_DIR = Path(__file__).resolve().parent / ".cache"


def coord_key(namespace: str, lat: float, lng: float, precision: int = DEFAULT_COORD_PRECISION) -> str:
    """Build a stable cache key for a namespace + rounded coordinate."""
    rlat = round(lat, precision)
    rlng = round(lng, precision)
    raw = f"{namespace}:{rlat}:{rlng}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{namespace}_{rlat}_{rlng}_{digest}"


class TTLCache:
    """A TTL cache with in-memory and optional on-disk persistence."""

    def __init__(
        self,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        persist: bool = True,
        cache_dir: Path | None = None,
    ) -> None:
        self.ttl_seconds = ttl_seconds
        self.persist = persist
        self._dir = cache_dir or _CACHE_DIR
        self._mem: dict[str, tuple[float, Any]] = {}
        if self.persist:
            self._dir.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        return self._dir / f"{key}.json"

    def get(self, key: str) -> Any | None:
        """Return a cached value if present and unexpired, else None."""
        hit = self._mem.get(key)
        now = time.time()
        if hit and now - hit[0] < self.ttl_seconds:
            return hit[1]

        if self.persist:
            path = self._path(key)
            if path.exists():
                try:
                    payload = json.loads(path.read_text())
                    if now - payload["stored_at"] < self.ttl_seconds:
                        self._mem[key] = (payload["stored_at"], payload["value"])
                        return payload["value"]
                except (json.JSONDecodeError, KeyError, OSError):
                    # Corrupt cache entry — ignore and treat as a miss.
                    return None
        return None

    def set(self, key: str, value: Any) -> None:
        """Store a value in memory and (optionally) on disk."""
        now = time.time()
        self._mem[key] = (now, value)
        if self.persist:
            try:
                self._path(key).write_text(json.dumps({"stored_at": now, "value": value}))
            except OSError:
                # Disk persistence is best-effort; in-memory still holds the value.
                pass

    def clear(self) -> None:
        """Clear the in-memory cache (on-disk entries are left to expire)."""
        self._mem.clear()


# Module-level default cache shared across sources.
default_cache = TTLCache()

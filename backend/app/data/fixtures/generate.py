"""Generate demo fixtures by running the live aggregator for each demo city.

Run from the backend directory with the venv active:

    python -m app.data.fixtures.generate

This fetches real data for Boston, Worcester, and Springfield and writes the
serialized results next to this file. Re-run to refresh the cached demo data.
Values written are genuine API responses — nothing is invented. If a source is
unavailable at generation time, its metrics are saved as missing (with reasons),
which is still a faithful, demo-safe snapshot.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.data.aggregator import get_location_metrics
from app.data.fixtures import DEMO_LOCATIONS

_OUT_DIR = Path(__file__).resolve().parent


async def main() -> None:
    for name, coords in DEMO_LOCATIONS.items():
        print(f"Fetching {name} ({coords.lat}, {coords.lng}) ...")
        result = await get_location_metrics(coords.lat, coords.lng)
        path = _OUT_DIR / f"{name}.json"
        path.write_text(json.dumps(result.model_dump(mode="json"), indent=2))
        ok = sum(
            1 for g in result.groups for m in g.metrics if m.value is not None
        )
        total = sum(len(g.metrics) for g in result.groups)
        print(f"  wrote {path.name}: {ok}/{total} metrics present")


if __name__ == "__main__":
    asyncio.run(main())

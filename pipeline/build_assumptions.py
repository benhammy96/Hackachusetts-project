#!/usr/bin/env python3
"""Fetch the economic and emissions inputs for the cost card.

Writes public/data/assumptions.json. Every entry carries its own source, vintage
and status so the UI can state where a number came from, and so a scenario
input (PUE, WUE, utilisation) is never displayed as if it were measured.

Sources
  * EIA Electric Power Monthly Table 5.6.A — average retail price of electricity
    by state and sector.
  * EPA eGRID2023 Summary Tables — output emission rates by subregion and state.

Usage:
    .venv-pipeline/bin/python pipeline/build_assumptions.py
"""

from __future__ import annotations

import io
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "assumptions.json"

EIA_URL = "https://www.eia.gov/electricity/monthly/xls/table_5_06_a.xlsx"
EIA_PAGE = "https://www.eia.gov/electricity/monthly/"
EGRID_URL = "https://www.epa.gov/system/files/documents/2025-06/summary_tables_rev2.xlsx"
EGRID_PAGE = "https://www.epa.gov/egrid/summary-data"

LB_PER_KG = 0.45359237


def load_workbook(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "atlas-pipeline/0.1"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return openpyxl.load_workbook(io.BytesIO(r.read()), read_only=True, data_only=True)


def num(v) -> float | None:
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def eia_industrial_price(state_name: str = "Massachusetts") -> dict:
    wb = load_workbook(EIA_URL)
    ws = wb[wb.sheetnames[0]]
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    period = None
    for r in rows[:4]:
        for c in r:
            if isinstance(c, str) and c.strip().startswith("by State,"):
                period = c.replace("by State,", "").strip()
    # Header row 3 labels the paired current / year-ago columns.
    header = [str(c) if c is not None else "" for c in rows[3]]
    for r in rows:
        if r and isinstance(r[0], str) and r[0].strip() == state_name:
            cents = num(r[5])  # Industrial, current period
            if cents is None:
                break
            return {
                "value": round(cents / 100.0, 5),
                "unit": "USD/kWh",
                "label": f"{state_name} average industrial retail price",
                "period": (header[5] if len(header) > 5 else None) or period,
                "status": "verified",
                "source": "EIA Electric Power Monthly, Table 5.6.A",
                "source_url": EIA_PAGE,
                "file_url": EIA_URL,
                "caveat": (
                    "A statewide sector average. A large load would negotiate a tariff "
                    "or contract; this is not a project quote, and Massachusetts is "
                    "creating large-load rate schedules that do not exist here."
                ),
            }
    raise SystemExit(f"could not find {state_name} in EIA table 5.6.A")


def egrid_rates(subregion: str = "NEWE", state: str = "MA") -> dict:
    wb = load_workbook(EGRID_URL)

    def find(sheet: str, key_col: int, key: str, val_col: int) -> float | None:
        ws = wb[sheet]
        for r in ws.iter_rows(values_only=True):
            if r and len(r) > max(key_col, val_col):
                cell = r[key_col]
                if isinstance(cell, str) and cell.strip() == key:
                    return num(r[val_col])
        return None

    sub = find("Table 1", 1, subregion, 6)   # CO2e, lb/MWh
    st = find("Table 3", 1, state, 5)        # CO2e, lb/MWh
    if sub is None and st is None:
        raise SystemExit("could not read eGRID CO2e rates")
    chosen = sub if sub is not None else st
    return {
        "value": round(chosen * LB_PER_KG, 2),
        "unit": "kg CO2e/MWh",
        "label": f"eGRID {subregion} subregion total output CO2e rate",
        "status": "verified",
        "source": "EPA eGRID2023 Summary Tables, Table 1 (subregion output emission rates)",
        "source_url": EGRID_PAGE,
        "file_url": EGRID_URL,
        "alternatives": {
            "subregion_lb_per_mwh": sub,
            f"state_{state}_lb_per_mwh": st,
            f"state_{state}_kg_per_mwh": round(st * LB_PER_KG, 2) if st else None,
        },
        "caveat": (
            "An annual average output rate for the whole subregion. It is not a "
            "marginal emission rate, and it is not market-based Scope 2 accounting."
        ),
    }


SCENARIO_INPUTS = {
    "pue": {
        "value": 1.3,
        "range": [1.15, 1.5],
        "unit": "ratio",
        "label": "Power usage effectiveness",
        "status": "assumption",
        "source": "Atlas scenario input — adjust in the cost panel",
        "caveat": (
            "PUE is a scenario input, not a measurement of any facility. The low end "
            "reflects a well-run new build and the high end an average operating site."
        ),
    },
    "wue": {
        "value": 1.8,
        "range": [0.0, 3.5],
        "unit": "L/kWh of facility energy",
        "label": "Water usage effectiveness",
        "status": "assumption",
        "source": "Atlas scenario input — adjust in the cost panel",
        "caveat": (
            "WUE is a scenario input with a declared denominator of total facility "
            "energy. Closed-loop and air-cooled designs approach zero on-site "
            "evaporative water use; the default describes an evaporative design."
        ),
    },
    "utilisation_hours": {
        "value": 8760,
        "range": [6000, 8760],
        "unit": "hours/year",
        "label": "Operating hours at full IT load",
        "status": "assumption",
        "source": "Atlas scenario input",
        "caveat": (
            "8,760 hours assumes continuous full utilisation, which overstates a real "
            "ramp-up year. IT_MW refers to IT load, not total site demand."
        ),
    },
    "construction_usd_per_mw": {
        "value": 10_000_000,
        "range": [7_000_000, 15_000_000],
        "unit": "USD per MW of IT capacity",
        "label": "Illustrative construction cost",
        "status": "assumption",
        "source": "Atlas scenario input — replace with a project estimate",
        "caveat": (
            "A placeholder order of magnitude for comparing sites, not a cost estimate "
            "for any project. Land, interconnection and site works are excluded."
        ),
    },
}


def main() -> None:
    price = eia_industrial_price()
    carbon = egrid_rates()
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "note": (
            "Measured inputs carry status 'verified' with a publisher and period. "
            "Scenario inputs carry status 'assumption' and must be presented as "
            "assumptions wherever a derived figure is shown."
        ),
        "electricity_price": price,
        "grid_carbon": carbon,
        "scenario": SCENARIO_INPUTS,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2))
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"  electricity_price = ${price['value']}/kWh  ({price['period']})")
    print(f"  grid_carbon       = {carbon['value']} kg CO2e/MWh")


if __name__ == "__main__":
    main()

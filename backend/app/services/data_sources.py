"""External data integration layer.

Placeholder adapters for the data sources that feed the scoring engine:
OpenStreetMap (infrastructure/land), FEMA (flood/hazard risk), US Census
(community/demographics), and energy APIs (grid/renewables).

The data integration teammate will implement real fetching and caching here.
Each function returns typed placeholder data for now so the scoring service
has a stable contract to build against.
"""

from __future__ import annotations

from app.config import get_settings
from app.models.site import Coordinates


async def fetch_osm_infrastructure(coords: Coordinates) -> dict[str, float]:
    """Return nearby infrastructure metrics from OpenStreetMap.

    TODO(data): query the Overpass API at ``settings.osm_overpass_url``.
    """
    _ = get_settings().osm_overpass_url
    return {"road_density": 0.0, "power_lines_nearby": 0.0, "fiber_proximity_km": 0.0}


async def fetch_fema_hazards(coords: Coordinates) -> dict[str, float]:
    """Return environmental hazard metrics from FEMA.

    TODO(data): query ``settings.fema_api_base`` for flood zones and risk.
    """
    _ = get_settings().fema_api_base
    return {"flood_risk": 0.0, "wildfire_risk": 0.0, "seismic_risk": 0.0}


async def fetch_census_community(coords: Coordinates) -> dict[str, float]:
    """Return community/demographic metrics from the US Census.

    TODO(data): query the Census API using ``settings.census_api_key``.
    """
    _ = get_settings().census_api_key
    return {"population_density": 0.0, "median_income": 0.0, "unemployment_rate": 0.0}


async def fetch_energy_profile(coords: Coordinates) -> dict[str, float]:
    """Return energy grid and renewables metrics.

    TODO(data): integrate an energy data provider (e.g. EIA, WattTime).
    """
    return {"grid_capacity_mw": 0.0, "renewable_share": 0.0, "avg_price_mwh": 0.0}

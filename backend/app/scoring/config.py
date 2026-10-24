"""Scoring configuration: weights and screening thresholds.

Everything here is a *configurable screening assumption*, not a scientifically
validated safety limit. Thresholds exist to turn raw geographic metrics into a
comparable 0-100 suitability signal for shortlisting candidate locations. They
are deliberately explicit and documented so reviewers can see — and adjust —
every judgement the algorithm makes.

The category weights reuse the shared defaults from ``app.models.site`` so the
frontend, backend, and scoring engine agree on one source of truth.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models.site import DEFAULT_WEIGHTS, ScoreCategory

# Re-export the canonical default weights (community .25, energy .25,
# environmental .20, infrastructure .15, land .15) as plain floats keyed by the
# shared enum. Kept as the single source of truth.
DEFAULT_CATEGORY_WEIGHTS: dict[ScoreCategory, float] = dict(DEFAULT_WEIGHTS)


@dataclass(frozen=True)
class ScoringThresholds:
    """Tunable screening thresholds used by the category scorers.

    All values are assumptions for *site shortlisting*, chosen to be reasonable
    and transparent — not regulatory limits. Override by constructing a custom
    instance and passing it to the engine.
    """

    # --- Community: buffer from residents is better for a data center. ---
    # Distance (m) to nearest residential feature at/above which community
    # impact is considered minimal (full marks on the proximity sub-score).
    ideal_residential_buffer_m: float = 1000.0
    # Distance (m) below which proximity impact is considered maximal (0 marks).
    min_residential_buffer_m: float = 50.0
    # Population density (people/km^2) at/below which density impact is minimal.
    low_pop_density_per_km2: float = 50.0
    # Population density at/above which density impact is maximal.
    high_pop_density_per_km2: float = 5000.0

    # --- Environmental: lower hazard is better. ---
    # Trailing max temperature (°C) at/below which cooling-stress is minimal.
    benign_max_temp_c: float = 30.0
    # Trailing max temperature (°C) at/above which cooling-stress is maximal.
    severe_max_temp_c: float = 42.0

    # --- Infrastructure: some surrounding development signals access. ---
    # Residential feature density (features/km^2) treated as "well connected".
    developed_density_per_km2: float = 40.0

    # --- Land: parcel size supports a data center footprint. ---
    # Parcel area (m^2) at/above which land suitability (size) is full marks.
    ample_parcel_area_m2: float = 40000.0  # ~10 acres
    # Parcel area (m^2) at/below which size suitability is 0.
    min_parcel_area_m2: float = 2000.0

    # --- Screening disqualifiers (flagged separately from the score). ---
    # A verified Special Flood Hazard Area (FEMA SFHA) disqualifies by default.
    disqualify_in_sfha: bool = True


@dataclass(frozen=True)
class ScoringConfig:
    """Top-level scoring configuration."""

    thresholds: ScoringThresholds = field(default_factory=ScoringThresholds)


DEFAULT_CONFIG = ScoringConfig()

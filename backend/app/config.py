"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central application settings.

    Values are read from environment variables or a local ``.env`` file.
    See ``.env.example`` for the full list of supported variables.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- App ---
    app_name: str = "Atlas API"
    environment: str = "development"
    debug: bool = True

    # --- CORS ---
    # Comma-separated list of allowed origins for the frontend dev server.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- AI (Claude) ---
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-3-5-sonnet-latest"

    # --- External data APIs ---
    census_api_key: str | None = None
    fema_api_base: str = "https://www.fema.gov/api/open"
    osm_overpass_url: str = "https://overpass-api.de/api/interpreter"

    # FEMA National Flood Hazard Layer (NFHL) ArcGIS REST service (public).
    # Distinct from fema_api_base (openFEMA); used by the flood data source.
    fema_nfhl_url: str = (
        "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer"
    )

    # MassGIS land-use / parcel ArcGIS layer query URL (optional, secondary
    # source). Leave unset until the exact published layer is confirmed; the
    # land-use source degrades gracefully when this is empty.
    massgis_landuse_url: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a cleaned list."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def ai_enabled(self) -> bool:
        """True when an Anthropic API key is configured for live Claude calls."""
        return bool(self.anthropic_api_key and self.anthropic_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()

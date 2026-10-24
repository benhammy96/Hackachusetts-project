"""Dataset registry for the Atlas pipeline.

Every field written to public/data/hexes.json traces back to an entry here.
`meta.json` is generated from this registry so the UI can show provenance
(publisher, URL, vintage, licence, and the measurement status) next to every
number it displays.

status values (see UI_DESIGN.md section 12):
  verified    - measured directly from the publisher's dataset
  modeled     - derived from publisher data with a documented assumption
  proxy       - a stand-in variable that is not the thing being measured
  unavailable - no data loaded in this build

A source that feeds no published field directly carries a `role` saying what
it is used for (a hard exclusion screen, or the basemap), so the provenance
dialog can list it rather than drop it.
"""

MASSGIS_REST = "https://arcgisserver.digital.mass.gov/arcgisserver/rest/services"
OVERPASS = "https://overpass-api.de/api/interpreter"
TIGERWEB = (
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/"
    "State_County/MapServer/0"
)

SOURCES = {
    "tiger_state": {
        "name": "Census TIGERweb — State boundary (MA, FIPS 25)",
        "publisher": "US Census Bureau",
        "url": TIGERWEB,
        "landing_page": "https://tigerweb.geo.census.gov/tigerwebmain/TIGERweb_restmapservice.html",
        "vintage": "TIGERweb current",
        "license": "US Government work, public domain",
        "status": "verified",
        "role": "basemap",
    },
    "massgis_hydro": {
        "name": "MassGIS Major Hydrography (lakes and ponds)",
        "publisher": "MassGIS",
        "url": f"{MASSGIS_REST}/AGOL/Hydro_Major/MapServer/2",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-major-ponds-and-major-streams",
        "vintage": "MassGIS current",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "basemap",
        "caveat": "Used only to draw the basemap, not in any score.",
    },
    "massgis_base_streets": {
        "name": "MassGIS Base Streets",
        "publisher": "MassGIS",
        "url": "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Roads/VectorTileServer",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-base-streets",
        "vintage": "MassGIS current, loaded as live vector tiles",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "basemap",
        "caveat": (
            "Optional display layer only; it requires a network connection and is not "
            "used in any score or distance measurement."
        ),
    },
    "massgis_towns": {
        "name": "MassGIS Census 2020 Towns",
        "publisher": "MassGIS (Bureau of Geographic Information)",
        "url": f"{MASSGIS_REST}/AGOL/Census2020_Towns/MapServer/2",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-municipalities",
        "vintage": "Census 2020",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_census_blocks": {
        "name": "MassGIS Census 2020 Blocks (POP20)",
        "publisher": "MassGIS / US Census Bureau",
        "url": f"{MASSGIS_REST}/AGOL/Census2020_Base_Geography/MapServer/1",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-2020-us-census",
        "vintage": "2020 Decennial Census (PL 94-171)",
        "license": "MassGIS open data / public domain",
        "status": "verified",
        "caveat": (
            "Residents within 1 km sums POP20 for census blocks whose Census-assigned "
            "internal point falls within 1 km of the cell centre. Block-level geography "
            "keeps the aggregation error small but the result is still an estimate."
        ),
    },
    "massgis_ej2020": {
        "name": "MassGIS 2020 US Census Environmental Justice Populations",
        "publisher": "MassGIS / EEA",
        "url": f"{MASSGIS_REST}/AGOL/EJ2020/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-2020-us-census-environmental-justice-populations",
        "vintage": "2020 Census / 2019 ACS income",
        "license": "MassGIS open data",
        "status": "verified",
        "caveat": (
            "This layer contains only designated EJ block groups, so it answers "
            "'is this an EJ block group' but cannot be used for total population."
        ),
    },
    "massgis_openspace": {
        "name": "MassGIS Protected and Recreational OpenSpace",
        "publisher": "MassGIS / EEA",
        "url": f"{MASSGIS_REST}/AGOL/openspace/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-protected-and-recreational-openspace",
        "vintage": "continuously updated",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "exclusion",
    },
    "massdep_wetlands": {
        "name": "MassDEP Wetlands (DEP Wetland Areas)",
        "publisher": "Massachusetts Department of Environmental Protection",
        "url": f"{MASSGIS_REST}/AGOL/DEP_Wetlands_FieldMaps/MapServer/1",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdep-wetlands-2005",
        "vintage": "MassDEP wetlands programme",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "exclusion",
    },
    "fema_nfhl": {
        "name": "FEMA National Flood Hazard Layer (served by MassGIS)",
        "publisher": "FEMA",
        "url": f"{MASSGIS_REST}/FEMA/FEMA_National_Flood_Hazard_Layer/MapServer/0",
        "landing_page": "https://hazards.fema.gov/nfhl/",
        "vintage": "NFHL as served by MassGIS",
        "license": "US Government work, public domain",
        "status": "verified",
    },
    "massdep_zone1": {
        "name": "MassDEP Approved Zone I (public water supply wells)",
        "publisher": "MassDEP",
        "url": f"{MASSGIS_REST}/AGOL/Zone1/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdep-approved-zone-i-areas",
        "vintage": "MassDEP current",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "exclusion",
    },
    "massdep_zonea": {
        "name": "MassDEP Surface Water Protection Zone A",
        "publisher": "MassDEP",
        "url": f"{MASSGIS_REST}/AGOL/ZoneABC/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdep-surface-water-supply-protection-areas",
        "vintage": "MassDEP current",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "exclusion",
    },
    "massdep_zone2": {
        "name": "MassDEP Approved Wellhead Protection Areas (Zone II) and IWPA",
        "publisher": "MassDEP",
        "url": f"{MASSGIS_REST}/AGOL/IWPA_Zone2/MapServer",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdep-approved-wellhead-protection-areas-zone-ii",
        "vintage": "MassDEP current",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_lclu2016": {
        "name": "MassGIS 2016 Land Cover / Land Use",
        "publisher": "MassGIS / EEA",
        "url": f"{MASSGIS_REST}/AGOL/LandCoverLandUse2016/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-2016-land-coverland-use",
        "vintage": "2016",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_sw_supply": {
        "name": "MassGIS Surface Water Supply Watersheds",
        "publisher": "MassDEP / MassGIS",
        "url": f"{MASSGIS_REST}/AGOL/Surface_Water_Supply_Watersheds/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdep-surface-water-supply-protection-areas",
        "vintage": "MassDEP current",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_schools": {
        "name": "MassGIS Schools (PK-12)",
        "publisher": "MassGIS / DESE",
        "url": f"{MASSGIS_REST}/AGOL/Schools_PK12/MapServer",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-schools-pk-12",
        "vintage": "DESE current",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_hospitals": {
        "name": "MassGIS Hospitals",
        "publisher": "MassGIS / DPH",
        "url": f"{MASSGIS_REST}/AGOL/Hospitals/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-acute-care-hospitals",
        "vintage": "DPH current",
        "license": "MassGIS open data",
        "status": "verified",
        "role": "school_or_hospital_500m",
    },
    "massgis_highways": {
        "name": "MassGIS Major Highways",
        "publisher": "MassGIS / MassDOT",
        "url": f"{MASSGIS_REST}/AGOL/MajorHighways/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdot-roads",
        "vintage": "MassDOT current",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_elec_providers": {
        "name": "MassGIS Electricity Providers by Town",
        "publisher": "MassGIS / DOER",
        "url": f"{MASSGIS_REST}/AGOL/ElectricityProviders/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-public-utility-service-providers",
        "vintage": "DOER current",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "massgis_aul": {
        "name": "MassDEP Activity and Use Limitation (AUL) sites",
        "publisher": "MassDEP",
        "url": f"{MASSGIS_REST}/AGOL/AUL_Sites/MapServer/0",
        "landing_page": "https://www.mass.gov/info-details/massgis-data-massdep-activity-and-use-limitation-aul-sites",
        "vintage": "MassDEP current",
        "license": "MassGIS open data",
        "status": "verified",
    },
    "czm_slr": {
        "name": "NOAA / MA CZM Sea Level Rise inundation extents",
        "publisher": "NOAA Office for Coastal Management / MA CZM",
        "url": f"{MASSGIS_REST}/AGOL/CZM_NOAA_SLR_Data_Combined/MapServer/0",
        "landing_page": "https://coast.noaa.gov/slrdata/",
        "vintage": "NOAA SLR viewer data",
        "license": "US Government work, public domain",
        "status": "verified",
    },
    "osm_power_lines": {
        "name": "OpenStreetMap power=line ways with a voltage tag",
        "publisher": "OpenStreetMap contributors (via Overpass API)",
        "url": OVERPASS,
        "landing_page": "https://wiki.openstreetmap.org/wiki/Tag:power%3Dline",
        "vintage": "live extract at grid build time",
        "license": "ODbL 1.0",
        "status": "verified",
        "caveat": (
            "Crowd-sourced; mapping coverage is incomplete and voltage tags are "
            "not audited. Distance to a mapped line is not interconnection capacity."
        ),
    },
    "osm_power_plants": {
        "name": "OpenStreetMap non-emitting generation (power=plant / generator)",
        "publisher": "OpenStreetMap contributors (via Overpass API)",
        "url": OVERPASS,
        "landing_page": "https://wiki.openstreetmap.org/wiki/Tag:power%3Dplant",
        "vintage": "live extract at grid build time",
        "license": "ODbL 1.0",
        "status": "proxy",
        "caveat": (
            "Proximity to generation is not a clean-energy procurement pathway and "
            "does not establish Clean Energy Standard eligibility."
        ),
    },
}

# Build-level limits, written for the reader of the provenance dialog. Plain
# language, no field codes.
NOTES = [
    "Fiber routes are not measured. No licensed fiber-route dataset is loaded, so the "
    "fiber factor is left out of the score. Distance to a major highway is shown "
    "separately as road access. It is not a fiber measurement.",
    "Water stress is not measured. No stressed-basin index is loaded, so the water "
    "factor is left out of the score. Supply-watershed membership and Zone II "
    "distance are shown as evidence only.",
    "Distance to a mapped transmission line is not interconnection capacity.",
    "Polygon overlaps are preliminary screens, not legal determinations.",
    "Map overlays are simplified for display. The per-cell flags come from "
    "full-resolution queries.",
    "The grid holds raw measurements. Scores are calculated in your browser from them.",
]

# Field -> source id and measurement status. Drives meta.json and the UI
# provenance rows. Keep in sync with lib/types.ts HexRecord.
FIELD_SOURCES = {
    "town": ("massgis_towns", "verified"),
    "d_tx69_km": ("osm_power_lines", "verified"),
    "d_tx115_km": ("osm_power_lines", "verified"),
    "d_tx345_km": ("osm_power_lines", "verified"),
    "d_clean_km": ("osm_power_plants", "proxy"),
    "mlp_town": ("massgis_elec_providers", "proxy"),
    "d_highway_km": ("massgis_highways", "verified"),
    "d_fiber_km": (None, "unavailable"),
    "land_class": ("massgis_lclu2016", "verified"),
    "land_use_name": ("massgis_lclu2016", "verified"),
    "land_cover_name": ("massgis_lclu2016", "verified"),
    "pop_1km": ("massgis_census_blocks", "modeled"),
    "school_or_hospital_500m": ("massgis_schools", "verified"),
    "in_ej": ("massgis_ej2020", "verified"),
    "near_ej_1mi": ("massgis_ej2020", "verified"),
    "d_ej_km": ("massgis_ej2020", "verified"),
    "ej_criteria": ("massgis_ej2020", "verified"),
    "water_stress": (None, "unavailable"),
    "in_sw_supply_watershed": ("massgis_sw_supply", "proxy"),
    "d_dw_zone2_km": ("massdep_zone2", "verified"),
    "flood_100yr": ("fema_nfhl", "verified"),
    "flood_500yr": ("fema_nfhl", "verified"),
    "coastal_slr": ("czm_slr", "verified"),
    "developed_frac_1km": ("massgis_lclu2016", "modeled"),
    "brownfield": ("massgis_aul", "proxy"),
    "aul_site_500m": ("massgis_aul", "verified"),
    "excluded": (None, "modeled"),
    "exclude_reason": (None, "modeled"),
}

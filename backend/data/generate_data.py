"""Synthetic data generator for PrevDengue.

Because validated DGHS surveillance data is not bundled with this project,
this module fabricates an *epidemiologically plausible* dataset so the full
ML pipeline, API and dashboard can run end-to-end.

What it models (weekly, all 64 districts, 2000-2023):
  * Climate: seasonal temperature, monsoon humidity & rainfall.
  * Demographics: population, density, urban proportion, agricultural land.
  * Dengue cases: a latent transmission process driven by lagged rainfall,
    optimal-temperature windows, humidity, population density, urbanisation
    and autoregressive epidemic momentum -- plus the real-world 2019 and
    2023 outbreak spikes and the 2023 nationwide geographic expansion
    (63% of cases outside Dhaka).

Outputs (CSV) into backend/data/raw/:
  districts.csv, climate_weekly.csv, dengue_weekly.csv
"""
from __future__ import annotations

import json
import math
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

from districts_meta import DIVISION_MAP, METRO_DISTRICTS, DISTRICT_NAME_BN

DATA_DIR = Path(__file__).resolve().parent
RAW_DIR = DATA_DIR / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
GEOJSON = DATA_DIR / "bd_districts.geojson"

YEAR_START = 2000
YEAR_END = 2023
RNG = np.random.default_rng(42)

# Global calibration so simulated 2023 totals approximate the real crisis
# (~321k cases, ~1,705 deaths nationally).
CASE_SCALE = 0.34

# Divisions roughly ordered south(warm/coastal) -> north(cool/dry)
DIVISION_CLIMATE = {
    "Barisal": dict(temp=+0.8, rain=1.25, hum=+4),
    "Chittagong": dict(temp=+0.6, rain=1.35, hum=+5),
    "Khulna": dict(temp=+0.5, rain=1.00, hum=+2),
    "Dhaka": dict(temp=+0.3, rain=1.05, hum=+1),
    "Sylhet": dict(temp=-0.2, rain=1.60, hum=+6),
    "Mymensingh": dict(temp=-0.3, rain=1.20, hum=+2),
    "Rajshahi": dict(temp=-0.2, rain=0.80, hum=-3),
    "Rangpur": dict(temp=-0.6, rain=0.85, hum=-2),
}


# ---------------------------------------------------------------------------
# Geometry helpers (centroid + approximate area from lon/lat polygons)
# ---------------------------------------------------------------------------
def _iter_rings(geom: dict):
    t = geom["type"]
    coords = geom["coordinates"]
    if t == "Polygon":
        yield coords[0]
    elif t == "MultiPolygon":
        for poly in coords:
            yield poly[0]


def _centroid_and_area(geom: dict) -> tuple[float, float, float]:
    """Return (lon, lat, area_sqkm) using planar approximation at BD latitude."""
    all_pts: list[tuple[float, float]] = []
    area_deg2 = 0.0
    for ring in _iter_rings(geom):
        all_pts.extend(ring)
        # shoelace (absolute) in degrees^2
        s = 0.0
        for i in range(len(ring) - 1):
            x1, y1 = ring[i]
            x2, y2 = ring[i + 1]
            s += x1 * y2 - x2 * y1
        area_deg2 += abs(s) / 2.0
    lon = sum(p[0] for p in all_pts) / len(all_pts)
    lat = sum(p[1] for p in all_pts) / len(all_pts)
    km_per_deg_lat = 111.0
    km_per_deg_lon = 111.320 * math.cos(math.radians(lat))
    area_sqkm = area_deg2 * km_per_deg_lat * km_per_deg_lon
    return lon, lat, area_sqkm


# ---------------------------------------------------------------------------
# District master table
# ---------------------------------------------------------------------------
def build_districts() -> pd.DataFrame:
    gj = json.loads(GEOJSON.read_text(encoding="utf-8"))
    rows = []
    for i, feat in enumerate(sorted(gj["features"], key=lambda f: f["properties"]["shapeName"]), start=1):
        name = feat["properties"]["shapeName"]
        lon, lat, area = _centroid_and_area(feat["geometry"])
        division = DIVISION_MAP.get(name, "Dhaka")
        is_metro = name in METRO_DISTRICTS

        if name == "Dhaka":
            population = int(RNG.integers(9_000_000, 11_000_000))
            urban = 0.92
        elif is_metro:
            population = int(RNG.integers(2_500_000, 4_500_000))
            urban = float(RNG.uniform(0.45, 0.70))
        else:
            population = int(RNG.integers(900_000, 2_600_000))
            urban = float(RNG.uniform(0.10, 0.33))

        agri = float(np.clip(0.85 - urban + RNG.normal(0, 0.05), 0.15, 0.88))
        density = population / max(area, 1.0)
        rows.append(dict(
            id=i, name=name, name_bn=DISTRICT_NAME_BN.get(name, name),
            division=division, lat=round(lat, 5), lon=round(lon, 5),
            area_sqkm=round(area, 1), population=population,
            pop_density=round(density, 1), urban_proportion=round(urban, 3),
            agri_land_pct=round(agri, 3), is_metro=int(is_metro),
        ))
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Weekly climate + dengue generation
# ---------------------------------------------------------------------------
def iso_weeks() -> list[tuple[int, int, date]]:
    """Return (year, week_of_year, week_start_monday) tuples across the range."""
    out = []
    d = date(YEAR_START, 1, 1)
    d -= timedelta(days=d.weekday())  # back to Monday
    while d.year <= YEAR_END:
        iso_year, iso_week, _ = d.isocalendar()
        if YEAR_START <= iso_year <= YEAR_END:
            out.append((iso_year, iso_week, d))
        d += timedelta(weeks=1)
    return out


def year_outbreak_factor(year: int) -> float:
    """Secular trend + known Bangladesh outbreak years."""
    base = 1.0 + 0.06 * (year - YEAR_START)  # slow growth as urbanisation rises
    spikes = {2016: 1.6, 2018: 1.8, 2019: 3.4, 2022: 2.4, 2023: 8.5}
    return base * spikes.get(year, 1.0)


def generate() -> None:
    districts = build_districts()
    weeks = iso_weeks()

    climate_rows: list[dict] = []
    dengue_rows: list[dict] = []

    for _, d in districts.iterrows():
        clim = DIVISION_CLIMATE[d["division"]]
        # district-level transmission susceptibility
        urban = d["urban_proportion"]
        log_density = math.log10(d["pop_density"])
        prev_cases = 5.0  # autoregressive seed

        for (yr, woy, wstart) in weeks:
            phase = 2 * math.pi * (woy / 52.0)
            # --- Climate ---
            temp = 26.5 + clim["temp"] + 5.5 * math.sin(phase - 1.3) + RNG.normal(0, 0.8)
            humidity = 72 + clim["hum"] + 14 * math.sin(phase - 1.0) + RNG.normal(0, 3)
            humidity = float(np.clip(humidity, 35, 98))
            # monsoon rainfall: heavy May-Sep (weeks ~18-39)
            monsoon = max(0.0, math.sin(math.pi * (woy - 16) / 30.0)) if 16 <= woy <= 46 else 0.0
            rainfall = clim["rain"] * (monsoon * 95 + RNG.normal(0, 8))
            rainfall = float(max(0.0, rainfall))

            climate_rows.append(dict(
                district_id=int(d["id"]), year=yr, week_of_year=woy,
                week_start=wstart.isoformat(), mean_temp=round(temp, 2),
                mean_humidity=round(humidity, 1), total_rainfall=round(rainfall, 1),
                source="synthetic",
            ))

            # --- Dengue latent transmission ---
            # optimal Aedes temperature window ~28-32C
            temp_suit = math.exp(-((temp - 30.0) ** 2) / (2 * 4.0 ** 2))
            hum_suit = 1.0 / (1.0 + math.exp(-(humidity - 70) / 4.0))
            rain_suit = monsoon  # standing water from monsoon
            seasonal = max(0.0, math.sin(math.pi * (woy - 26) / 24.0)) if 22 <= woy <= 50 else 0.0

            yf = year_outbreak_factor(yr)
            # 2023 nationwide expansion: lift non-metro districts especially
            geo_lift = 1.0
            if yr == 2023 and d["name"] not in METRO_DISTRICTS:
                geo_lift = 2.3
            if yr == 2019 and d["name"] not in METRO_DISTRICTS:
                geo_lift = 1.4

            transmission = (
                0.9 * temp_suit
                + 0.7 * hum_suit
                + 0.8 * rain_suit
                + 0.6 * seasonal
                + 0.45 * (log_density - 2.5)
                + 0.9 * urban
            )
            transmission = max(0.0, transmission)

            # autoregressive epidemic momentum (bounded)
            momentum = 0.35 * math.log1p(prev_cases)
            lam_core = math.exp(0.6 * transmission + momentum - 1.5)
            scale = d["population"] / 1_000_000.0
            expected = lam_core * scale * yf * geo_lift * (0.4 + 0.9 * seasonal)
            expected = float(min(expected * CASE_SCALE, 14_000.0))  # cap weekly/district
            cases = int(RNG.poisson(max(0.02, expected)))

            # deaths: case fatality rises when surge outpaces hospital capacity
            surge = expected > 400
            cfr = 0.0030 + (0.0065 if surge else 0.0)
            deaths = int(RNG.binomial(cases, min(cfr, 0.05))) if cases > 0 else 0
            hospitalized = int(cases * RNG.uniform(0.35, 0.6))

            dengue_rows.append(dict(
                district_id=int(d["id"]), year=yr, week_of_year=woy,
                report_week=wstart.isoformat(), confirmed_cases=cases,
                deaths=deaths, hospitalized=hospitalized, source="synthetic",
            ))
            prev_cases = 0.6 * prev_cases + 0.4 * cases

    districts.to_csv(RAW_DIR / "districts.csv", index=False)
    pd.DataFrame(climate_rows).to_csv(RAW_DIR / "climate_weekly.csv", index=False)
    pd.DataFrame(dengue_rows).to_csv(RAW_DIR / "dengue_weekly.csv", index=False)

    total = sum(r["confirmed_cases"] for r in dengue_rows if r["year"] == 2023)
    deaths_23 = sum(r["deaths"] for r in dengue_rows if r["year"] == 2023)
    print(f"Districts: {len(districts)}")
    print(f"Climate rows: {len(climate_rows):,}  Dengue rows: {len(dengue_rows):,}")
    print(f"Simulated 2023 cases: {total:,}  deaths: {deaths_23:,}")


if __name__ == "__main__":
    generate()

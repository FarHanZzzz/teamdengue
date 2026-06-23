"""Generate a hospital/health-facility registry for all 64 districts.

Each facility gets realistic coordinates (offset from the district centroid),
bed capacity, and contact details. Distances are computed with the haversine
formula so the map and citizen portal can show correct, consistent km values.
"""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
RAW_DIR = DATA_DIR / "raw"
RNG = np.random.default_rng(7)

METRO = {"Dhaka", "Narayanganj", "Gazipur", "Chittagong", "Khulna",
         "Rajshahi", "Sylhet", "Barisal", "Comilla", "Mymensingh"}


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 2)


def generate() -> None:
    districts = pd.read_csv(RAW_DIR / "districts.csv")
    rows = []
    hid = 1
    for _, d in districts.iterrows():
        clat, clon = d["lat"], d["lon"]
        is_metro = d["name"] in METRO

        facilities = [
            (f"{d['name']} District Sadar Hospital", "District Hospital",
             250 if is_metro else int(RNG.integers(100, 175)), 0.015),
        ]
        if is_metro:
            facilities.append(
                (f"{d['name']} Medical College Hospital", "Medical College Hospital",
                 int(RNG.integers(500, 1000)), 0.03)
            )
        # 2-3 upazila health complexes spread further out
        for k in range(int(RNG.integers(2, 4))):
            facilities.append(
                (f"{d['name']} Upazila Health Complex {k + 1}", "Upazila Health Complex",
                 int(RNG.integers(31, 50)), 0.12)
            )

        for name, ftype, beds, spread in facilities:
            lat = clat + float(RNG.normal(0, spread))
            lon = clon + float(RNG.normal(0, spread))
            rows.append(dict(
                id=hid, name=name, type=ftype, district_id=int(d["id"]),
                district=d["name"], lat=round(lat, 5), lon=round(lon, 5),
                beds=beds, dengue_beds=max(8, int(beds * 0.25)),
                phone=f"+88018{int(RNG.integers(10, 99))}{int(RNG.integers(100000, 999999))}",
                email=f"contact.{name.lower().split(' ')[0]}{hid}@hospital.gov.bd",
                dist_from_center_km=haversine_km(clat, clon, lat, lon),
            ))
            hid += 1

    df = pd.DataFrame(rows)
    df.to_csv(RAW_DIR / "hospitals.csv", index=False)
    print(f"Generated {len(df)} hospitals across {districts.shape[0]} districts.")
    print(f"  Total beds: {df['beds'].sum():,} · dengue-ready beds: {df['dengue_beds'].sum():,}")


if __name__ == "__main__":
    generate()

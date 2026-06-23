import os
import pandas as pd
from datetime import datetime, timedelta
from database import SessionLocal, engine, Base
from models import District, ClimateRecord, DengueCase

# Create all tables in the database
Base.metadata.create_all(bind=engine)

def ingest_districts_and_climate(data_dir="data"):
    print("Starting data ingestion into database...")
    db = SessionLocal()
    
    baseline_path = os.path.join(data_dir, "bangladesh_baseline_clean.csv")
    hydromet_path = os.path.join(data_dir, "ee_remaining_hydromet_recent.csv")
    
    if not os.path.exists(baseline_path) or not os.path.exists(hydromet_path):
        print("Data files not found. Ensure 'bangladesh_baseline_clean.csv' and 'ee_remaining_hydromet_recent.csv' exist in the data directory.")
        return

    # Load baseline for districts
    baseline_df = pd.read_csv(baseline_path)
    
    districts_added = 0
    # Create districts
    if 'district_name' in baseline_df.columns:
        if 'pop_density' not in baseline_df.columns:
            baseline_df['pop_density'] = baseline_df['pop_base'] / baseline_df['area_km2'].replace(0, 1)
            
        district_data = baseline_df.groupby('district_name').agg({
            'pop_base': 'mean',
            'pop_density': 'mean',
            'built_density': 'mean'
        }).reset_index()
        
        for _, row in district_data.iterrows():
            dist_name = row['district_name']
            # Check if exists
            existing = db.query(District).filter(District.name == dist_name).first()
            if not existing:
                dist = District(
                    name=dist_name,
                    population=int(row.get('pop_base', 0)),
                    density=float(row.get('pop_density', 0.0)),
                    urban_pct=float(row.get('built_density', 0.0))
                )
                db.add(dist)
                districts_added += 1
        
        db.commit()
        print(f"Added/Updated {districts_added} districts.")

    # Load climate/hydromet data
    hydro_df = pd.read_csv(hydromet_path)
    
    # Attempt to merge district names if hydro_df only has locality_code
    if 'district_name' not in hydro_df.columns and 'locality_code' in hydro_df.columns and 'district_name' in baseline_df.columns:
        mapping = baseline_df[['locality_code', 'district_name']].drop_duplicates()
        hydro_df = pd.merge(hydro_df, mapping, on='locality_code', how='inner')
    
    if 'district_name' not in hydro_df.columns:
        print("Cannot map climate records to district names.")
        db.close()
        return

    # To avoid huge inserts, we will just sample some recent climate data or aggregate
    # The Aftershock CSV has things like gpm_rain_30d_mm, era5_temp_max_recent_c
    
    records_added = 0
    # Group by district and just take the mean to insert a "current" climate record for simulation
    # Ideally, hydromet data would have a date column, but since it doesn't, we simulate the current week.
    current_date = datetime.utcnow().date()
    
    agg_hydro = hydro_df.groupby('district_name').mean(numeric_only=True).reset_index()
    
    for _, row in agg_hydro.iterrows():
        dist_name = row['district_name']
        
        # Check if record for this date exists
        existing = db.query(ClimateRecord).filter(
            ClimateRecord.district_name == dist_name,
            ClimateRecord.date == current_date
        ).first()
        
        if not existing:
            # We map some CSV columns to our schema
            max_t = float(row.get('era5_temp_max_recent_c', 0.0))
            min_t = float(row.get('era5_temp_min_recent_c', 0.0))
            rain = float(row.get('gpm_rain_30d_mm', 0.0))
            
            # Since humidity isn't directly in this subset explicitly (or might have another name), we mock it
            humid = 75.0 
            
            record = ClimateRecord(
                district_name=dist_name,
                date=current_date,
                max_temp=max_t,
                min_temp=min_t,
                humidity=humid,
                rainfall_mm=rain
            )
            db.add(record)
            records_added += 1

    db.commit()
    print(f"Added {records_added} climate records for date {current_date}.")
    
    db.close()

if __name__ == "__main__":
    ingest_districts_and_climate(data_dir=os.path.join(os.path.dirname(__file__), "data"))

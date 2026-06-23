import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import os

class DenguePredictor:
    def __init__(self, data_dir="data"):
        self.data_dir = data_dir
        self.model = xgb.XGBRegressor(n_estimators=100, max_depth=4, learning_rate=0.1, random_state=42)
        self.explainer = None
        self.features = []
        self.baseline_df = None
        self.district_df = None
        self.district_mapping = {}
        
    def ingest_data(self):
        # Load baseline data
        baseline_path = os.path.join(self.data_dir, "bangladesh_baseline_clean.csv")
        hydromet_path = os.path.join(self.data_dir, "ee_remaining_hydromet_recent.csv")
        
        if os.path.exists(baseline_path):
            self.baseline_df = pd.read_csv(baseline_path)
        else:
            print(f"Baseline data not found at {baseline_path}.")
            return False
            
        if os.path.exists(hydromet_path):
            hydro_df = pd.read_csv(hydromet_path)
            # Merge on district_name or locality_code
            if 'locality_code' in self.baseline_df.columns and 'locality_code' in hydro_df.columns:
                self.baseline_df = pd.merge(self.baseline_df, hydro_df, on='locality_code', how='inner', suffixes=('', '_drop'))
                # Drop duplicate columns
                to_drop = [c for c in self.baseline_df.columns if c.endswith('_drop')]
                self.baseline_df.drop(columns=to_drop, inplace=True)
                
        # Generate synthetic historical dengue cases for training
        np.random.seed(42)
        
        # Select numeric features
        self.features = [c for c in self.baseline_df.columns if pd.api.types.is_numeric_dtype(self.baseline_df[c]) and c not in ['dengue_cases', 'locality_code', 'district_name', 'locality_name']]
        
        # Fill NA values
        self.baseline_df[self.features] = self.baseline_df[self.features].fillna(0)
        
        # Synthetic target based on some features + noise
        if 'pop_base' in self.baseline_df.columns and 'gpm_rain_30d_mm' in self.baseline_df.columns:
            base_risk = self.baseline_df['pop_base'] / 1000 + self.baseline_df['gpm_rain_30d_mm'] * 0.5
        else:
            base_risk = np.random.rand(len(self.baseline_df)) * 100
            
        self.baseline_df['dengue_cases'] = np.maximum(0, base_risk * (1 + np.random.randn(len(self.baseline_df)) * 0.2))
        
        # Aggregate to district level for predictions
        if 'district_name' in self.baseline_df.columns:
            self.district_df = self.baseline_df.groupby('district_name').mean(numeric_only=True).reset_index()
            self.district_mapping = {row['district_name']: row for _, row in self.district_df.iterrows()}
        else:
            # Fallback
            self.district_df = self.baseline_df
            self.district_mapping = {f"Dist_{i}": row for i, row in self.district_df.iterrows()}
            
        return True
        
    def train_model(self):
        if self.baseline_df is None or len(self.baseline_df) == 0:
            return False
            
        X = self.baseline_df[self.features]
        y = self.baseline_df['dengue_cases']
        
        self.model.fit(X, y)
        self.explainer = shap.TreeExplainer(self.model)
        return True
        
    def predict_all_districts(self):
        if not self.district_mapping:
            return []
            
        X_pred = self.district_df[self.features]
        preds = self.model.predict(X_pred)
        shap_values = self.explainer.shap_values(X_pred)
        
        forecasts = []
        for i, (idx, row) in enumerate(self.district_df.iterrows()):
            district = row['district_name'] if 'district_name' in row else f"Dist_{i}"
            cases = float(preds[i])
            
            # Calibrate thresholds based on dummy generation
            if cases > 300: risk = "Critical"
            elif cases > 150: risk = "High"
            elif cases > 50: risk = "Medium"
            else: risk = "Low"
            
            # Top 3 SHAP features
            sv = shap_values[i]
            top_indices = np.argsort(np.abs(sv))[-3:]
            top_features = [{"feature": self.features[idx], "impact": float(sv[idx])} for idx in reversed(top_indices)]
            
            forecasts.append({
                "district": district,
                "predicted_cases": int(cases),
                "risk_level": risk,
                "top_factors": top_features
            })
            
        return forecasts

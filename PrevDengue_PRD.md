# Product Requirements Document (PRD): PrevDengue

## 1. Project Overview
**Name:** PrevDengue  
**Description:** A machine learning-powered dengue outbreak prediction and early warning system designed for Bangladesh. It predicts outbreaks 2–4 weeks in advance across all 64 districts, generating localized risk scores and automated alerts.
**Goal:** Shift public health response from reactive crisis management to pre-emptive intervention (fogging, bed allocation, public advisories) to reduce late-stage presentations and fatalities.

---

## 2. Target Audience & User Personas
1. **Public Health Administrators (DGHS):** Require a high-level, aggregate view of the country, historical trend analysis, and model explainability (SHAP) to justify resource allocation and deploy fogging teams.
2. **District Hospital Administrators:** Need district-specific 2-4 week forecasts to manage surge capacity (IV fluids, ICU beds, staff scheduling).
3. **Citizens / General Public:** Need a highly accessible, bilingual (English/Bengali) interface to check their district's current risk level and receive actionable prevention guidance.

---

## 3. Core Features & Requirements

### 3.1. Interactive Web Dashboard
* **National Choropleth Map:** An interactive map of Bangladesh's 64 districts. Districts are color-coded based on predicted risk levels: `Low (Green)`, `Medium (Yellow)`, `High (Orange)`, `Critical (Red)`.
* **District Detail View:** Clicking a district reveals:
  * Current vs. Predicted case counts (Trend charts).
  * 2-4 week forward-looking forecast.
  * **Model Explainability (SHAP):** A visual breakdown (e.g., bar chart) showing *why* the risk is high (e.g., "High Rainfall + High Population Density").
* **Citizen Portal:** A simplified, mobile-responsive view toggleable between English and Bengali. Users can search/select their district to see the risk level and prevention tips.

### 3.2. Machine Learning Engine
* **Models:** Ensemble tree-based models (XGBoost, LightGBM).
* **Output:** Generates a regression output (projected case counts) mapped to a categorical Risk Score (Low, Medium, High, Critical).
* **Explainability:** SHAP (SHapley Additive exPlanations) integration to quantify feature importance per prediction.
* **Feature Engineering:**
  * Temporally lagged climate variables (e.g., rainfall from 3 weeks ago).
  * Rolling cumulative rainfall (14-day, 21-day sums).
  * Humidity threshold flags (e.g., days with >80% humidity).
  * Autoregressive case counts (cases in week T-1, T-2).

### 3.3. Automated Alert Module
* **Threshold Triggers:** When a district crosses from `Medium` to `High` or `Critical`.
* **Notifications:** Automated SMS and Email dispatch to registered District Health Officers.

### 3.4. REST API
* Endpoints to serve the frontend (e.g., `/api/forecasts/national`, `/api/forecasts/district/{id}`, `/api/alerts`).
* Designed to be easily integrated into existing DGHS surveillance infrastructure.

---

## 4. Technical Stack Requirements
* **Frontend:** Next.js (React) or Vite + React, Tailwind CSS (for styling), `react-leaflet` & `leaflet` (for the choropleth map), `recharts` or `Chart.js` (for trend charts).
* **Backend:** Python FastAPI (fast, excellent for ML integration), PostgreSQL or SQLite (for storing historical data and predictions).
* **Machine Learning:** `pandas`, `scikit-learn`, `xgboost`, `lightgbm`, `shap`.
* **Localization:** `i18next` or `react-intl` (for English/Bengali toggling).

---

## 5. Required Datasets & Sources (Bangladesh Context)

To build and train the models accurately as per the abstract, you will need the following real-world data sources:

### A. Epidemiological Target Data
* **Data:** Weekly/Monthly Dengue cases and deaths per district (2000–2023).
* **Source:** **DGHS (Directorate General of Health Services)** daily health bulletins. (Alternatively, the **Humanitarian Data Exchange (HDX)** maintains cleaned historical dengue datasets for Bangladesh).

### B. Climatic & Environmental Data
* **Data:** Temperature (Min, Max, Mean), Humidity, Rainfall/Precipitation.
* **Source:** 
  * **BMD (Bangladesh Meteorological Department)**.
  * **NASA POWER** (Prediction of Worldwide Energy Resources) API - highly recommended as it provides historical, coordinate-based weather data perfectly suited for script-based scraping.
  * **Google Earth Engine (ERA5 / CHIRPS datasets)** - for precise satellite-derived rainfall and land-surface temperatures.

### C. Sociodemographic Data
* **Data:** Population density, total population, urban-to-rural proportion per district.
* **Source:** **Bangladesh Bureau of Statistics (BBS)** - Specifically the recent 2022 Population & Housing Census. Also, **WorldPop** provides high-resolution population density maps.

### D. Landscape & Land Use Data
* **Data:** Agricultural land use proportion, urbanization density, water body proximity.
* **Source:** **ESA WorldCover** (10m resolution land cover maps) or **OpenStreetMap (OSM)** via Overpass API to calculate the ratio of built-up area to vegetation.

### E. Geospatial Base Maps
* **Data:** GeoJSON or Shapefiles outlining the exact boundaries of the 64 districts.
* **Source:** **HDX (Humanitarian Data Exchange)** - Search for "Bangladesh - Subnational Administrative Boundaries" (Admin Level 2 represents districts).

---

## 6. System Architecture Flow
1. **Data Ingestion (Cron Job):** Backend fetches latest weather forecasts (API) and current case counts.
2. **Feature Pipeline:** Generates lagged features and rolling averages.
3. **Inference:** XGBoost/LightGBM predicts cases for Weeks T+2 to T+4.
4. **Post-Processing:** Calculates SHAP values; Maps case predictions to Risk Levels.
5. **Database Update:** Saves predictions to DB.
6. **Alert Check:** If Risk > Threshold, trigger SMS/Email via Twilio/SendGrid APIs.
7. **Client Render:** Dashboard fetches latest DB state and renders Leaflet map.

---

## 7. AI Agent Development Instructions
When handing this to an AI to build, instruct it to:
1. Initialize the backend and frontend in separate folders.
2. Create dummy data generators matching the features described in Section 5 to unblock frontend development while real data is being collected.
3. Start with the GeoJSON integration on `react-leaflet` to ensure the 64 districts render correctly.
4. Build the ML pipeline as a modular class so real datasets can easily be swapped in later.

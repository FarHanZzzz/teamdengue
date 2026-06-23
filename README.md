# PrevDengue

A machine learning-powered dengue outbreak prediction and early warning system designed for Bangladesh.

## Project Structure

- `frontend/`: Next.js/Vite React application with Tailwind CSS and Leaflet for the interactive dashboard.
- `backend/`: FastAPI Python application for serving the ML model and predictions via REST API.
- `PrevDengue_PRD.md`: The complete Product Requirements Document.

## Getting Started

### Frontend
1. Navigate to the `frontend` directory: `cd frontend`
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

### Backend
1. Navigate to the `backend` directory: `cd backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Start the API server: `uvicorn main:app --reload`

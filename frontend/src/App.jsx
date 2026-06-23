import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = "http://127.0.0.1:8000";

function App() {
  const [nationalForecast, setNationalForecast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/api/forecasts/national`)
      .then(response => {
        setNationalForecast(response.data.forecast);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        setLoading(false);
      });
  }, []);

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'Critical': return 'bg-red-500 text-white';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-yellow-400 text-black';
      case 'Low': return 'bg-green-500 text-white';
      default: return 'bg-gray-200 text-black';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-emerald-800 text-white shadow-lg p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PrevDengue</h1>
          <p className="text-emerald-100 mt-1">Dengue Outbreak Prediction & Early Warning System</p>
        </div>
        <div className="flex gap-4">
          <button className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded shadow transition">
            English
          </button>
          <button className="bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded shadow transition">
            বাংলা
          </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: List of Districts */}
        <section className="col-span-1 bg-white rounded-xl shadow-md p-6 border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">District Risk Forecast</h2>
          {loading ? (
            <div className="animate-pulse flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-slate-200 rounded"></div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2">
              {nationalForecast.map((item, index) => (
                <div key={index} className="p-4 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center hover:shadow-md transition cursor-pointer">
                  <div>
                    <h3 className="font-semibold text-slate-700">{item.district}</h3>
                    <p className="text-sm text-slate-500">{item.predicted_cases} Predicted Cases</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(item.risk_level)}`}>
                    {item.risk_level}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right Column: Map & Details */}
        <section className="col-span-1 lg:col-span-2 flex flex-col gap-8">
          <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden" style={{ height: '500px' }}>
            <MapContainer center={[23.6850, 90.3563]} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              {/* Map placeholder for GeoJSON */}
            </MapContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-red-50 p-6 rounded-xl border border-red-100 shadow-sm">
              <h4 className="text-red-800 font-semibold mb-1">Critical Districts</h4>
              <p className="text-3xl font-bold text-red-600">
                {nationalForecast.filter(f => f.risk_level === 'Critical').length || '-'}
              </p>
            </div>
            <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 shadow-sm">
              <h4 className="text-orange-800 font-semibold mb-1">High Risk Districts</h4>
              <p className="text-3xl font-bold text-orange-600">
                {nationalForecast.filter(f => f.risk_level === 'High').length || '-'}
              </p>
            </div>
            <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 shadow-sm">
              <h4 className="text-emerald-800 font-semibold mb-1">Low Risk Districts</h4>
              <p className="text-3xl font-bold text-emerald-600">
                {nationalForecast.filter(f => f.risk_level === 'Low').length || '-'}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: `${API_BASE}/api/v1` });

// Attach the demo bearer token (= user id) on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pd_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const endpoints = {
  summary: () => api.get("/summary").then((r) => r.data),
  forecasts: () => api.get("/forecasts").then((r) => r.data),
  districts: () => api.get("/districts").then((r) => r.data),
  geojson: () => api.get("/districts/geojson").then((r) => r.data),
  hospitals: (districtId) =>
    api.get("/hospitals", { params: districtId ? { district_id: districtId } : {} }).then((r) => r.data),
  hospitalsNear: (lat, lon, limit = 5) =>
    api.get("/hospitals/near", { params: { lat, lon, limit } }).then((r) => r.data),
  agentPlan: () => api.get("/agent/plan").then((r) => r.data),
  agentExecute: (district_ids) =>
    api.post("/agent/execute", { district_ids }).then((r) => r.data),
  agentAsk: (question) => api.post("/agent/ask", { question }).then((r) => r.data),
  agentCitizen: (district, symptoms, language = "en") =>
    api.post("/agent/citizen", { district, symptoms, language }).then((r) => r.data),
  districtForecast: (id) => api.get(`/forecasts/${id}`).then((r) => r.data),
  history: (id) => api.get(`/history/${id}`).then((r) => r.data),
  citizenRisk: (name) =>
    api.get(`/citizens/risk/${encodeURIComponent(name)}`).then((r) => r.data),
  modelMetrics: () => api.get("/model/metrics").then((r) => r.data),
  alerts: () => api.get("/alerts").then((r) => r.data),
  sendAlert: (body) => api.post("/alerts/send", body).then((r) => r.data),
  generateForecast: () => api.post("/forecasts/generate").then((r) => r.data),
  uploads: () => api.get("/data/uploads").then((r) => r.data),
  uploadDataset: (formData) =>
    api.post("/data/upload", formData).then((r) => r.data),
  login: (email) => api.post("/auth/login", { email }).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  demoAccounts: () => api.get("/auth/demo-accounts").then((r) => r.data),
};

export const reportUrls = {
  national: `${API_BASE}/api/v1/reports/national.pdf`,
  district: (id) => `${API_BASE}/api/v1/reports/district/${id}.pdf`,
  csv: `${API_BASE}/api/v1/reports/export.csv`,
};

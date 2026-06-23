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

  // Community response
  wards: (districtId) =>
    api.get("/wards", { params: districtId ? { district_id: districtId } : {} }).then((r) => r.data),
  ward: (id) => api.get(`/wards/${id}`).then((r) => r.data),
  communityJoin: (payload) => api.post("/community/join", payload).then((r) => r.data),
  communityWorkers: (wardId) =>
    api.get("/community/workers", { params: { ward_id: wardId } }).then((r) => r.data),
  dispatchCreate: (payload) => api.post("/dispatch", payload).then((r) => r.data),
  dispatchList: (wardId, status) =>
    api.get("/dispatch", { params: { ...(wardId ? { ward_id: wardId } : {}), ...(status ? { status } : {}) } }).then((r) => r.data),
  dispatchUpdate: (id, status, actor) =>
    api.patch(`/dispatch/${id}`, { status, actor }).then((r) => r.data),
  chatList: (wardId) => api.get("/chat", { params: { ward_id: wardId } }).then((r) => r.data),
  chatPost: (payload) => api.post("/chat", payload).then((r) => r.data),
  communityUpload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/community/upload", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },
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

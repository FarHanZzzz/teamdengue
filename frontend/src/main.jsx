import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { I18nProvider } from "./context/I18nContext";
import Layout from "./components/Layout";
import Spinner from "./components/Spinner";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Agent from "./pages/Agent";
import DistrictDetail from "./pages/DistrictDetail";
import Citizen from "./pages/Citizen";
import Hospital from "./pages/Hospital";
import Alerts from "./pages/Alerts";
import Admin from "./pages/Admin";
import Login from "./pages/Login";

function Protected({ allow, children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/agent" element={<Agent />} />
              <Route path="/district/:id" element={<DistrictDetail />} />
              <Route path="/citizen" element={<Citizen />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/hospital"
                element={
                  <Protected allow={["dho", "hospital_admin", "dghs_admin"]}>
                    <Hospital />
                  </Protected>
                }
              />
              <Route
                path="/alerts"
                element={
                  <Protected allow={["dghs_admin"]}>
                    <Alerts />
                  </Protected>
                }
              />
              <Route
                path="/admin"
                element={
                  <Protected allow={["dghs_admin"]}>
                    <Admin />
                  </Protected>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>
);

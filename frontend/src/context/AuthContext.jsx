import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { endpoints } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("pd_token");
    if (!token) {
      setLoading(false);
      return;
    }
    endpoints
      .me()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("pd_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email) => {
    const data = await endpoints.login(email);
    localStorage.setItem("pd_token", data.token);
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("pd_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === "dghs_admin",
      isOfficial: ["dho", "hospital_admin", "dghs_admin"].includes(user?.role),
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

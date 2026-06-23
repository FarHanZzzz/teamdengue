import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { endpoints } from "../lib/api";
import { useAuth } from "./AuthContext";

const AgentCtx = createContext(null);
const CACHE_KEY = "pd_agent_plan";

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
  } catch {
    return null;
  }
}

export function AgentProvider({ children }) {
  const { isOfficial } = useAuth();
  // Restore the last loaded plan instantly (survives close/reopen).
  const [plan, setPlan] = useState(readCache);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState(() => (readCache() ? Date.now() : null));
  // Whether the reasoning trace has already animated this session.
  const traceSeen = useRef(false);
  const started = useRef(false);

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    return endpoints
      .agentPlan()
      .then((p) => {
        setPlan(p);
        setLoadedAt(Date.now());
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(p));
        } catch {
          /* ignore quota */
        }
        return p;
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  // Preload in the background once an official/admin is signed in (the agent
  // is an official-only tool, so citizens/guests never trigger it).
  useEffect(() => {
    if (!isOfficial || started.current) return;
    started.current = true;
    if (plan) {
      // Already have a cached version → refresh quietly so it stays current.
      load({ silent: true });
    } else {
      load();
    }
  }, [isOfficial, plan, load]);

  const refresh = useCallback(() => {
    traceSeen.current = false;
    return load();
  }, [load]);

  return (
    <AgentCtx.Provider value={{ plan, loading, loadedAt, refresh, traceSeen }}>
      {children}
    </AgentCtx.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentCtx);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}

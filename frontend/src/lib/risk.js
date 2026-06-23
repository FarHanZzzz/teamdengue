export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

export const RISK_HEX = {
  Low: "#27AE60",
  Medium: "#F1C40F",
  High: "#E67E22",
  Critical: "#C0392B",
};

// Colour-blind friendly: each level also carries an icon (PRD 17.2).
export const RISK_ICON = {
  Low: "●",
  Medium: "▲",
  High: "◆",
  Critical: "✖",
};

export const riskBadgeClass = (level) =>
  ({
    Low: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
    Medium: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
    High: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
    Critical: "bg-red-100 text-red-800 ring-1 ring-red-200",
  }[level] || "bg-slate-100 text-slate-700");

export const riskDotClass = (level) =>
  ({
    Low: "bg-risk-low",
    Medium: "bg-risk-medium",
    High: "bg-risk-high",
    Critical: "bg-risk-critical",
  }[level] || "bg-slate-300");

export const trendArrow = (traj) => {
  if (!traj || traj.length < 2) return { dir: "stable", symbol: "→", cls: "text-slate-400" };
  const delta = traj[traj.length - 1].risk_score - traj[0].risk_score;
  if (delta > 0.04) return { dir: "rising", symbol: "↑", cls: "text-red-500" };
  if (delta < -0.04) return { dir: "falling", symbol: "↓", cls: "text-emerald-500" };
  return { dir: "stable", symbol: "→", cls: "text-slate-400" };
};

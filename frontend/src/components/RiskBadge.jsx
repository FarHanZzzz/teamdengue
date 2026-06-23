import { riskBadgeClass, RISK_ICON } from "../lib/risk";
import { useI18n } from "../context/I18nContext";

export default function RiskBadge({ level, score, size = "md" }) {
  const { level: tlevel } = useI18n();
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`chip ${pad} ${riskBadgeClass(level)}`}>
      <span aria-hidden>{RISK_ICON[level]}</span>
      {tlevel(level)}
      {score != null && <span className="opacity-70">· {Math.round(score * 100)}</span>}
    </span>
  );
}

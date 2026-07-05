// Small shared presentational primitives reused across the three views.
import type { Risk } from "./types";

export function RiskBadge({ risk }: { risk: Risk }) {
  const labels: Record<Risk, string> = {
    red: "RED · danger",
    amber: "AMBER · caution",
    green: "GREEN · safe",
  };
  return (
    <span className={`risk ${risk}`} title={`risk = ${risk}`}>
      <span className="led" />
      {labels[risk]}
    </span>
  );
}

export function Spinner({ label = "LOADING" }: { label?: string }) {
  return <span className="spin">▚ {label}…</span>;
}

// RunList = the left pane of the Console tab. Lists GET /api/runs newest-first; polls (~1.5s) so a live
// run's badge updates and newly-started runs appear. Clicking a row selects it.
import { useEffect, useState } from "react";
import { listRuns } from "../../api";
import type { RunSummary } from "../../types";
import { runChip, formatStartedAt, shortRunId } from "./console";

export function RunList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (r: RunSummary) => void }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const rows = await listRuns();
        if (alive) { setRuns(rows); setError(null); }
      } catch (e) {
        if (alive) setError(String(e));
      }
    };
    void tick();
    // Always poll (cheap) so newly-started runs appear; the interval is light at demo scale.
    const id = setInterval(() => void tick(), 1500);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="console-list">
      {error && <div className="banner err">{error}</div>}
      {runs.length === 0 && <div className="pc-id pad-sm">No runs yet.</div>}
      {runs.map((r) => {
        const badge = runChip(r);
        return (
          <div key={r.runId} data-testid={"run-row-" + r.runId} className={`console-run ${r.runId === selectedId ? "active" : ""}`} onClick={() => onSelect(r)}>
            <div className="row1">
              <span className="mono run-name">{r.name}@{r.version}</span>
              <span className="chip engine">{(r.engine ?? "temporal").toUpperCase()}</span>
              <span className={`chip ${badge.cls}`}>{badge.label}</span>
            </div>
            <div className="pc-id">{formatStartedAt(r.startedAt)} · <span className="mono" title={r.runId}>{shortRunId(r.runId)}</span></div>
          </div>
        );
      })}
    </div>
  );
}

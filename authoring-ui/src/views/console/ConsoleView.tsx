// ConsoleView = the 05 "Console" tab root. 2-pane: RunList (left) selects a run → RunDetail (right) renders
// its DAG read-only, lit by that run's per-node state. Pure composition; owns the selected run.
import { useState } from "react";
import type { RunSummary } from "../../types";
import { RunList } from "./RunList";
import { RunDetail } from "./RunDetail";

export function ConsoleView() {
  const [selected, setSelected] = useState<RunSummary | null>(null);
  return (
    <div className="console-grid">
      <RunList selectedId={selected?.runId ?? null} onSelect={setSelected} />
      <RunDetail run={selected} />
    </div>
  );
}

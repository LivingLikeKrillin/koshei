// Shared run-status helpers for the Console tab (and the compose RunPanel, which imports isTerminalStatus
// from here so there is ONE definition of "terminal"). Pure logic — unit-tested in console.test.ts.
//
// IMPORTANT (verified by run-console-gate.sh): the backend's queryStatus returns the Temporal proto enum
// NAME, e.g. "WORKFLOW_EXECUTION_STATUS_COMPLETED" — NOT a short "COMPLETED". So everything here NORMALIZES
// by stripping that prefix first. (This also fixes a latent no-op in RunPanel, whose old local
// `TERMINAL.has(status.toUpperCase())` never matched the long form — v0.3f shipped with no E2E test.)

/** Workflow-level statuses that mean the run is over (no more polling), in normalized short form. */
export const TERMINAL = new Set([
  "COMPLETED",
  "FAILED",
  "TERMINATED",
  "CANCELED",
  "CANCELLED",
  "TIMED_OUT",
]);

/** Strip the Temporal "WORKFLOW_EXECUTION_STATUS_" prefix (if present) and uppercase → short form. */
export function normalizeStatus(status: string): string {
  return status.toUpperCase().replace(/^WORKFLOW_EXECUTION_STATUS_/, "");
}

export function isTerminalStatus(status: string): boolean {
  return TERMINAL.has(normalizeStatus(status));
}

/** Terminal AND not COMPLETED — i.e. the run ended in failure/termination and can be re-run wholesale (v0.6d). */
export function isTerminalFailed(status: string): boolean {
  const s = normalizeStatus(status);
  return isTerminalStatus(s) && s !== "COMPLETED";
}

/** Map a status string to a display badge. "UNKNOWN" (aged/failed query) renders muted, not terminal. */
export function statusBadge(status: string): { label: string; cls: string } {
  const s = normalizeStatus(status);
  if (s === "COMPLETED") return { label: "DONE", cls: "ok" };
  if (s === "FAILED" || s === "TERMINATED" || s === "TIMED_OUT") return { label: s, cls: "err" };
  if (s === "RUNNING") return { label: "RUNNING", cls: "run" };
  return { label: s || "UNKNOWN", cls: "muted" };
}

/** B3: a COMPLETED run that ran compensation is "RECOVERED", not "DONE"; COMP_FAILED reads as an error. */
export function runOutcomeBadge(status: string, compOutcome?: string | null): { label: string; cls: string } {
  const s = normalizeStatus(status);
  if (s === "COMPLETED" && compOutcome === "COMPENSATED") return { label: "RECOVERED", cls: "recovered" };
  if (s === "COMPLETED" && compOutcome === "COMP_FAILED") return { label: "RECOVERY FAILED", cls: "err" };
  return statusBadge(status);
}

/** B1+B3: the chip a run row/head shows. Awaiting approval wins; else the outcome-aware badge. */
export function runChip(run: { status: string; awaitingApproval?: boolean; compOutcome?: string | null }): { label: string; cls: string } {
  if (run.awaitingApproval) return { label: "NEEDS APPROVAL", cls: "await" };
  return runOutcomeBadge(run.status, run.compOutcome);
}

/** nodeIds currently PARKED (failed, awaiting an operator retry/abort decision). Pure — unit-tested. */
export function parkedNodeIds(states: Record<string, string>): string[] {
  return Object.entries(states).filter(([, s]) => s === "PARKED").map(([id]) => id);
}

/** Map a compensation step outcome to a display badge (v0.4c). Pure — unit-tested. */
export function compOutcomeBadge(outcome: string): { label: string; cls: string } {
  return outcome === "COMPENSATED" ? { label: "COMPENSATED", cls: "ok" } : { label: "COMP FAILED", cls: "err" };
}

/** F11: a compact run-id for the operator eye-line; full id stays available via a title tooltip. */
export function shortRunId(id: string, head = 8): string {
  return id.length > head + 1 ? id.slice(0, head) + "…" : id;
}

/** Relative "Xs/m/h ago" from an epoch-millis start time. `now` is injectable for tests. */
export function formatStartedAt(epochMs: number, now: number = Date.now()): string {
  const sec = Math.max(0, Math.floor((now - epochMs) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

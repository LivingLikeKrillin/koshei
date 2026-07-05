// RunPanel = the bottom strip of the compose surface. Drives a deployed workflow run end-to-end:
//   Run → poll (node states + workflow status) every ~750ms → light up the canvas (states lifted up to
//   ComposeView) → on terminal, show the verdict (completed vs. compensated-in-reverse) → Approve/Reject
//   the human gate while the run is live.
//
// Terminal detection: the cheap non-wait GET /runs/{id} returns a `status` string; once it hits a known
// terminal value we stop polling and fire ONE GET /runs/{id}?wait=true to pull the verdict body
// {completed, compensatedInReverseOrder}. This avoids holding a long-poll open for the whole run.
import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeStates } from "../../types";
import {
  runWorkflow,
  getRunStatus,
  getNodeStates,
  approveRun,
  rejectRun,
  ApiError,
} from "../../api";
import { isTerminalStatus } from "../console/console";

export interface RunPanelProps {
  // The persisted workflow to run; null until the operator saves (=deploys) in the Inspector.
  saved: { name: string; version: string } | null;
  // Lift per-node states up so Canvas can color nodes via .ns-* classes.
  onNodeStates: (states: NodeStates) => void;
}

interface Verdict {
  completed?: boolean;
  compensatedInReverseOrder?: string[];
}

export function RunPanel({ saved, onNodeStates }: RunPanelProps) {
  const [failAtBlockId, setFailAtBlockId] = useState("");
  const [slowMs, setSlowMs] = useState("");
  const [interactive, setInteractive] = useState(false);
  const [reason, setReason] = useState("");

  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [terminal, setTerminal] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the latest onNodeStates without re-keying the polling effect.
  const onNodeStatesRef = useRef(onNodeStates);
  onNodeStatesRef.current = onNodeStates;

  // ---- Polling lifecycle: starts when a non-terminal runId exists; stops on terminal/unmount. ----
  useEffect(() => {
    if (!runId || terminal) return;
    let alive = true;

    const tick = async () => {
      try {
        const [states, st] = await Promise.all([
          getNodeStates(runId),
          getRunStatus(runId),
        ]);
        if (!alive) return;
        onNodeStatesRef.current(states);
        if (st.status) setStatus(st.status);
        if (st.status && isTerminalStatus(st.status)) {
          setTerminal(true); // effect re-runs, interval below is torn down by cleanup
          try {
            const final = await getRunStatus(runId, true);
            if (alive) setVerdict({ completed: final.completed, compensatedInReverseOrder: final.compensatedInReverseOrder });
          } catch {
            /* verdict fetch best-effort; status already terminal */
          }
        }
      } catch (e) {
        // A transient poll failure shouldn't crash the panel; surface it and keep polling.
        if (alive) setError(e instanceof ApiError ? `${e.status} ${e.message}` : String(e));
      }
    };

    void tick(); // immediate first read
    const id = setInterval(() => void tick(), 750);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [runId, terminal]);

  const handleRun = useCallback(async () => {
    if (!saved) return;
    setBusy(true);
    setError(null);
    setVerdict(null);
    setStatus("");
    // Deactivate any in-flight polling BEFORE the await: clearing runId makes the polling effect bail
    // (it guards on runId), so the loop can't re-color the canvas against the previous run during the
    // request window. `terminal` is reset together with the new runId once it lands (below), avoiding a
    // stale-poll re-activation against the old id.
    setRunId(null);
    onNodeStatesRef.current({}); // clear prior coloring — new run starts visually fresh
    try {
      const req: { failAtBlockId?: string; slowMs?: number; interactive?: boolean } = {};
      if (failAtBlockId.trim()) req.failAtBlockId = failAtBlockId.trim();
      const ms = Number(slowMs);
      if (slowMs.trim() && Number.isFinite(ms)) req.slowMs = ms;
      if (interactive) req.interactive = true;
      const { runId: newId } = await runWorkflow(saved.name, saved.version, req);
      setTerminal(false);
      setRunId(newId);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.status} ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }, [saved, failAtBlockId, slowMs, interactive]);

  const handleApprove = useCallback(async () => {
    if (!runId) return;
    try {
      await approveRun(runId);
    } catch (e) {
      setError(e instanceof ApiError ? `approve: ${e.status} ${e.message}` : String(e));
    }
  }, [runId]);

  const handleReject = useCallback(async () => {
    if (!runId) return;
    try {
      await rejectRun(runId, reason.trim() || "rejected by operator");
    } catch (e) {
      setError(e instanceof ApiError ? `reject: ${e.status} ${e.message}` : String(e));
    }
  }, [runId, reason]);

  const active = !!runId && !terminal;

  return (
    <div className="run-strip">
      <button data-testid="run-button" className="btn primary" disabled={!saved || busy || active} onClick={handleRun}>
        {busy ? "Starting…" : "▶ Run"}
      </button>

      <label className="field field-inline">
        <span className="pc-id">failAt</span>
        <input
          data-testid="failat-input"
          className="mono w-md"
          type="text"
          placeholder="blockId"
          value={failAtBlockId}
          onChange={(e) => setFailAtBlockId(e.target.value)}
        />
      </label>
      <label className="field field-inline">
        <span className="pc-id">slowMs</span>
        <input
          className="mono w-sm"
          type="number"
          placeholder="0"
          value={slowMs}
          onChange={(e) => setSlowMs(e.target.value)}
        />
      </label>
      <label className="field field-inline">
        <input data-testid="interactive-checkbox" type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} />
        <span className="pc-id">interactive (intervene on failure)</span>
      </label>

      {active && (
        <>
          <button data-testid="approve-button" className="btn" onClick={handleApprove}>
            ✓ Approve
          </button>
          <input
            className="mono w-lg"
            type="text"
            placeholder="reject reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button data-testid="reject-button" className="btn danger" onClick={handleReject}>
            ✕ Reject
          </button>
        </>
      )}

      <div className="pc-id push-right text-right">
        {!saved && <span>Save (deploy) to enable running.</span>}
        {runId && (
          <span>
            run <span className="mono">{runId}</span>
            {status && <> · {status}</>}
          </span>
        )}
      </div>

      {verdict && (
        <div className={`banner ${verdict.completed ? "ok" : "err"} banner-full`}>
          {verdict.completed
            ? "Done — all nodes completed"
            : `Compensated (reverse order): ${verdict.compensatedInReverseOrder?.join(" → ") || "-"}`}
        </div>
      )}
      {error && (
        <div className="banner err banner-full">
          {error}
        </div>
      )}
    </div>
  );
}

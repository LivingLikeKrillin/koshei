// RunDetail = the right pane of the Console tab. Given a recorded run (runId + name + version), it fetches
// the workflow def + palette, renders the DAG READ-ONLY via the shared graph.ts/BlockNode, and lights nodes
// from GET /runs/{id}/nodes. While the run is non-terminal it polls (states + status) and offers approve/
// reject (reused from the existing endpoints); once terminal it shows the final snapshot.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { getWorkflow, getPalette, getNodeStates, getRunStatus, approveRun, rejectRun, retryNode, abortRun, getCompensationTimeline } from "../../api";
import type { NodeStates, RunSummary, CompensationEvent, PaletteCard } from "../../types";
import { BlockNode } from "../compose/BlockNode";
import { toGraph, type BlockNodeData } from "../compose/graph";
import { isTerminalStatus, isTerminalFailed, runOutcomeBadge, parkedNodeIds, compOutcomeBadge, shortRunId } from "./console";

const nodeTypes = { block: BlockNode };

export function RunDetail({ run }: { run: RunSummary | null }) {
  const [baseNodes, setBaseNodes] = useState<Node<BlockNodeData>[]>([]);
  const [palette, setPalette] = useState<PaletteCard[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nodeStates, setNodeStates] = useState<NodeStates>({});
  const [timeline, setTimeline] = useState<CompensationEvent[]>([]);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

  const runId = run?.runId ?? null;

  // Load the static graph (def + palette → nodes/edges) whenever the selected run changes.
  useEffect(() => {
    if (!run) { setBaseNodes([]); setEdges([]); setNodeStates({}); setStatus(""); return; }
    let alive = true;
    setError(null);
    Promise.all([getWorkflow(run.name, run.version), getPalette()])
      .then(([def, palette]) => {
        if (!alive) return;
        const g = toGraph(def, palette);
        setBaseNodes(g.nodes);
        setEdges(g.edges);
        setPalette(palette);
      })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [run]);

  // Poll node states + status while the run is non-terminal; stop once terminal. EXCEPTION: a Conductor
  // failureWorkflow compensates AFTER the main run is already terminal (FAILED/TERMINATED), so on a failed run
  // keep polling a short grace window until the compensation surfaces (timeline non-empty) or the grace
  // elapses — otherwise the timeline/COMPENSATED lighting would never appear in the UI. A Temporal failed run
  // already has its timeline by the terminal poll (in-workflow compensation), and COMPLETED runs have none, so
  // both stop immediately (no regression / no needless polling).
  useEffect(() => {
    if (!runId) return;
    // Clear the previous run's lighting/status so switching A→B doesn't flash A's state on B's canvas
    // until B's first poll resolves.
    setNodeStates({});
    setTimeline([]);
    setStatus("");
    let alive = true;
    let terminalPolls = 0;
    // A Conductor failureWorkflow writes the timeline rows INCREMENTALLY after the main run is terminal, so on
    // a FAILED/TERMINATED run keep polling a fixed grace window (not "until the first row", which would freeze a
    // partial timeline) so every row + the COMPENSATED lighting surface. ~30 × 1s polls. Temporal already has
    // the full timeline at terminal (extra polls are harmless/idempotent); COMPLETED runs have no compensation
    // and stop at once.
    const TERMINAL_GRACE = 30;
    const tick = async () => {
      try {
        const [states, st, tl] = await Promise.all([getNodeStates(runId), getRunStatus(runId), getCompensationTimeline(runId)]);
        if (!alive) return;
        setNodeStates(states);
        setTimeline(tl);
        if (st.status) setStatus(st.status);
        if (st.status && isTerminalStatus(st.status)) {
          terminalPolls += 1;
          if (!isTerminalFailed(st.status) || terminalPolls >= TERMINAL_GRACE) clearInterval(id);
        }
      } catch (e) {
        if (alive) setError(String(e));
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1000);
    return () => { alive = false; clearInterval(id); };
  }, [runId, retryNonce]);

  // Inject live state into a render-only copy of the nodes (don't mutate base).
  const renderNodes = useMemo<Node<BlockNodeData>[]>(
    () => baseNodes.map((n) => {
      const s = nodeStates[n.id];
      return s ? { ...n, data: { ...n.data, nodeState: s } } : n;
    }),
    [baseNodes, nodeStates],
  );

  const active = !!runId && !!status && !isTerminalStatus(status);
  const isConductor = run?.engine === "conductor";
  const parked = useMemo(() => parkedNodeIds(nodeStates), [nodeStates]);
  const blockName = useMemo(() => new Map(palette.map((c) => [c.id, c.displayName])), [palette]);
  const awaiting = useMemo(() => Object.values(nodeStates).includes("AWAITING_APPROVAL"), [nodeStates]);
  const handleApprove = useCallback(async () => {
    if (runId) { try { await approveRun(runId); } catch (e) { setError(`approve: ${e}`); } }
  }, [runId]);
  const handleReject = useCallback(async () => {
    if (runId) { try { await rejectRun(runId, reason.trim() || "rejected by operator"); } catch (e) { setError(`reject: ${e}`); } }
  }, [runId, reason]);
  const handleRetry = useCallback(async (nodeId: string) => {
    if (runId) { try { await retryNode(runId, nodeId); } catch (e) { setError(`retry: ${e}`); } }
  }, [runId]);
  const handleAbort = useCallback(async () => {
    if (runId) { try { await abortRun(runId); } catch (e) { setError(`abort: ${e}`); } }
  }, [runId]);
  const handleRetryRun = useCallback(async () => {
    if (!runId) return;
    try { await retryNode(runId, ""); setRetryNonce((n) => n + 1); }  // Conductor whole-run retry; nodeId ignored
    catch (e) { setError(`retry: ${e}`); }
  }, [runId]);

  if (!run) return <div className="console-detail empty">Select a run on the left.</div>;

  // B3: derive the compensation outcome from the LIVE timeline this pane already polls (the run-summary's
  // compOutcome can be stale at selection time / null before archival). Falls back to the summary field.
  const detailCompOutcome = timeline.length > 0
    ? (timeline.every((e) => e.outcome === "COMPENSATED") ? "COMPENSATED" : "COMP_FAILED")
    : run.compOutcome;
  const badge = awaiting ? { label: "NEEDS APPROVAL", cls: "await" } : runOutcomeBadge(status || run.status, detailCompOutcome);
  return (
    <div className="console-detail">
      <div className="console-detail-head">
        <span className="mono">{run.name}@{run.version}</span>
        <span className={`chip ${badge.cls}`}>{badge.label}</span>
        <span className="mono pc-id" title={run.runId}>run {shortRunId(run.runId)}</span>
        {awaiting && <div className="banner await">⏳ 당신의 승인을 기다립니다 · Awaiting your approval</div>}
        {parked.length > 0 && !isConductor && (
          <span className="park-actions">
            {parked.map((id) => (
              <button key={id} data-testid={"retry-" + id} className="btn" onClick={() => handleRetry(id)}>↻ Retry {id}</button>
            ))}
          </span>
        )}
        {isConductor && isTerminalFailed(status) && (
          <span className="park-actions">
            <button data-testid="retry-run" className="btn" onClick={handleRetryRun}>↻ Retry (whole run)</button>
            <small className="hint">Conductor: re-runs the whole run (Temporal = per-node)</small>
          </span>
        )}
        {active && (
          <span className="gate-actions">
            <button data-testid="approve-button" className="btn" onClick={handleApprove}>✓ Approve</button>
            <input className="mono w-xl" placeholder="reject reason"
              value={reason} onChange={(e) => setReason(e.target.value)} />
            <button data-testid="reject-button" className="btn danger" onClick={handleReject}>✕ Reject</button>
            <button data-testid="abort-button" className="btn danger" onClick={handleAbort}>■ Abort</button>
          </span>
        )}
      </div>
      <div className="console-canvas">
        <ReactFlowProvider>
          <ReactFlow
            nodes={renderNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
          >
            <Background variant={BackgroundVariant.Lines} gap={44} color="var(--line-soft)" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      {timeline.length > 0 && (
        <div className="comp-timeline">
          <div className="comp-timeline-head">Compensation timeline (reverse order)</div>
          {timeline.every((e) => e.outcome === "COMPENSATED")
            ? <div className="comp-timeline-safe">라인은 안전하게 유지되었습니다 — 비가역 작동은 실행되지 않았습니다 · The line was left safe</div>
            : <div className="comp-timeline-unsafe">일부 되돌림이 실패했습니다 — 라인 상태를 확인하세요 · Some rollback steps failed — verify the line</div>}
          <ol className="comp-timeline-list">
            {timeline.map((e) => {
              const b = compOutcomeBadge(e.outcome);
              return (
                <li key={e.index} data-testid={"timeline-row-" + e.index} className="comp-timeline-row">
                  <span className="pc-id">#{e.index}</span>
                  <span>{(blockName.get(e.blockId) ?? e.nodeId)} 되돌림 · undone</span>
                  <span className="mono pc-id muted">{e.nodeId} ({e.blockId}@{e.version})</span>
                  <span className={`chip ${b.cls}`}>{b.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {error && <div className="banner err">{error}</div>}
    </div>
  );
}

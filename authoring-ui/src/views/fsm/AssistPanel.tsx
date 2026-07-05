// AssistPanel = a chat-style iterative surface. Each turn: an instruction + a mode ("gen" = fresh generate,
// "edit" = send the on-canvas spec as context) -> the model returns a full draft, serialized to YAML and
// handed up to FsmView for the YAML panel (review then Load). The transcript is CLIENT-SIDE, DISPLAY-ONLY —
// it is never sent to the LLM; each turn is still a stateless full replacement (the canvas is the
// conversation state). Fail-safe: on error the canvas is untouched and the error is recorded as a turn.
import { useRef, useState } from "react";
import { assistFsm } from "../../api";
import { emitFsmYaml } from "./fsmYaml";
import type { FsmSpec } from "./fsmTypes";

type TurnOutcome = { kind: "draft" } | { kind: "error"; message: string };
type Turn = { id: number; mode: "gen" | "edit"; instruction: string; outcome: TurnOutcome };

// Same 422-issues / 502-503-error / fallback extraction as the pre-polish component, factored out.
function extractError(e: unknown): string {
  const body = (e as { body?: unknown }).body;
  const issues = (body as { issues?: string[] } | null)?.issues;      // 422 repair-exhausted
  const serverErr = (body as { error?: string } | null)?.error;        // 502/503 carry {error:"reason"}
  return issues?.length ? issues.join("; ") : (serverErr ?? (e instanceof Error ? e.message : String(e)));
}

export function AssistPanel({ current, onDraft }: { current: FsmSpec; onDraft: (yaml: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [busyMode, setBusyMode] = useState<"gen" | "edit" | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);

  const busy = busyMode !== null;
  const canvasEmpty = current.states.length === 0 && current.transitions.length === 0;

  const run = async (mode: "gen" | "edit") => {
    const instruction = prompt.trim();
    if (!instruction) return;
    setBusyMode(mode); setPending(false);
    try {
      const draft = await assistFsm(instruction, mode === "edit" ? current : undefined);
      onDraft(emitFsmYaml(draft));
      setTurns((t) => [...t, { id: nextId.current++, mode, instruction, outcome: { kind: "draft" } }]);
      setPending(true);
      setPrompt("");                    // chat-style: composer clears after a sent turn (instruction is in the transcript)
    } catch (e: unknown) {
      const message = extractError(e);
      setTurns((t) => [...t, { id: nextId.current++, mode, instruction, outcome: { kind: "error", message } }]);
      // keep `prompt` on error so the user can fix and retry
    } finally { setBusyMode(null); }
  };

  return (
    <div className="panel">
      <div className="panel-head"><span>ASSIST (LLM)</span></div>
      <div className="inspector-section">
        {turns.length > 0 && (
          <div className="fsm-assist-transcript" data-testid="fsm-assist-transcript">
            {turns.map((t) => (
              <button key={t.id} type="button" className="fsm-assist-turn" data-testid="fsm-assist-turn"
                title="Reuse this instruction" onClick={() => setPrompt(t.instruction)}>
                <span className={`fsm-assist-badge ${t.mode}`}>{t.mode}</span>
                <span className="fsm-assist-turn-text">{t.instruction}</span>
                {t.outcome.kind === "draft"
                  ? <span className="fsm-assist-turn-ok">✓ draft</span>
                  : <span className="fsm-assist-turn-err" data-testid="fsm-assist-turn-err">✗ {t.outcome.message}</span>}
              </button>
            ))}
          </div>
        )}
        <textarea data-testid="fsm-assist-prompt" className="mono fsm-yaml-textarea" value={prompt}
          placeholder="Describe a new FSM, or an instruction to edit the current one…"
          onChange={(e) => setPrompt(e.target.value)} />
        <div className="fsm-assist-actions">
          <button className="btn primary" data-testid="fsm-assist-generate" disabled={busy || !prompt.trim()}
            onClick={() => run("gen")}>
            {busyMode === "gen" ? "Working…" : "Generate draft"}
          </button>
          <button className="btn" data-testid="fsm-assist-edit" disabled={busy || !prompt.trim() || canvasEmpty}
            onClick={() => run("edit")}>
            {busyMode === "edit" ? "Working…" : "Edit current"}
          </button>
        </div>
        {pending && <div className="banner ok" data-testid="fsm-assist-pending">✓ draft ready — review & Load it in the YAML panel below.</div>}
        <div className="pc-desc">Each instruction returns a full draft in the YAML panel — review it, then Load into the canvas. "Edit current" sends the on-canvas FSM so the model returns a complete updated spec. Final validation runs in the conformance gate after you commit.</div>
      </div>
    </div>
  );
}

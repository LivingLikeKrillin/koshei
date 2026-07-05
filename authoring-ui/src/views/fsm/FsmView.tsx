// FsmView = the 'fsm' tab surface. Owns meta + latest derived spec + selection. The FsmCanvas is the
// topology source of truth (nodes/edges); it pushes a derived FsmSpec + issues up on every change.
// Inspector edits patch the spec and reload it into the canvas (thin-PoC simple round-trip). The YAML
// panel emits from the latest spec and loads a pasted spec back into the canvas.
import { useCallback, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { FsmCanvas, type FsmCanvasHandle } from "./FsmCanvas";
import { MetaBar } from "./MetaBar";
import { FsmInspector, type Selection } from "./FsmInspector";
import { YamlPanel } from "./YamlPanel";
import { AssistPanel } from "./AssistPanel";
import { emitFsmYaml } from "./fsmYaml";
import type { FsmIssue } from "./fsmValidate";
import type { FsmMeta } from "./fsmGraph";
import type { FsmSpec, FsmState, FsmTransition } from "./fsmTypes";

const EMPTY_SPEC = (m: FsmMeta): FsmSpec => ({ ...m, states: [], transitions: [] });
const INITIAL_META: FsmMeta = { name: "packml-lineX", unit: "lineX", version: "v1", stateNode: "lineX.stateCurrent" };

export function FsmView() {
  const [meta, setMeta] = useState<FsmMeta>(INITIAL_META);
  const [spec, setSpec] = useState<FsmSpec>(() => EMPTY_SPEC(INITIAL_META));
  const [issues, setIssues] = useState<FsmIssue[]>([]);
  const [sel, setSel] = useState<{ kind: "state" | "transition"; id: string } | null>(null);
  const [proposalYaml, setProposalYaml] = useState("");
  const canvas = useRef<FsmCanvasHandle | null>(null);

  const onReady = useCallback((h: FsmCanvasHandle) => { canvas.current = h; }, []);
  const onChange = useCallback((s: FsmSpec, iss: FsmIssue[]) => { setSpec(s); setIssues(iss); }, []);

  // Resolve the current selection against the latest spec. Selection id is the synthetic node id
  // (state) or the transition id. States are matched positionally via toGraph's n<i> convention.
  const selection: Selection = useMemo(() => {
    if (!sel) return null;
    if (sel.kind === "transition") {
      const t = spec.transitions.find((x) => x.id === sel.id);
      return t ? { kind: "transition", transition: t } : null;
    }
    const idx = Number(sel.id.replace(/^n/, ""));
    const st = spec.states[idx];
    return st ? { kind: "state", state: st } : null;
  }, [sel, spec]);

  // Apply a patch to the selected element in the spec, then reload the patched spec into the canvas.
  const patchAndReload = (next: FsmSpec) => { setSpec(next); canvas.current?.loadSpec(next); };

  const onStateChange = (patch: Partial<FsmState>) => {
    if (sel?.kind !== "state") return;
    const idx = Number(sel.id.replace(/^n/, ""));
    const old = spec.states[idx];
    const states = spec.states.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    // A state's id is its foreign key from transitions (from/to). A rename must cascade,
    // else loadSpec->toGraph drops edges pointing at the old id and the transition vanishes.
    let transitions = spec.transitions;
    if (patch.id !== undefined && patch.id !== old.id) {
      transitions = transitions.map((t) => ({
        ...t,
        from: t.from === old.id ? patch.id! : t.from,
        to: t.to === old.id ? patch.id! : t.to,
      }));
    }
    patchAndReload({ ...spec, states, transitions });
  };
  const onTransitionChange = (patch: Partial<FsmTransition>) => {
    if (sel?.kind !== "transition") return;
    const transitions = spec.transitions.map((t) => {
      if (t.id !== sel.id) return t;
      const merged = { ...t, ...patch };
      if (merged.driver === "field") delete merged.action; // field => no action
      return merged;
    });
    patchAndReload({ ...spec, transitions });
  };
  const onDelete = () => {
    if (!sel) return;
    if (sel.kind === "transition") patchAndReload({ ...spec, transitions: spec.transitions.filter((t) => t.id !== sel.id) });
    else {
      const idx = Number(sel.id.replace(/^n/, ""));
      const gone = spec.states[idx]?.id;
      patchAndReload({
        ...spec,
        states: spec.states.filter((_, i) => i !== idx),
        transitions: spec.transitions.filter((t) => t.from !== gone && t.to !== gone),
      });
    }
    setSel(null);
  };

  const yaml = useMemo(() => emitFsmYaml(spec), [spec]);

  return (
    <div className="fsm-shell">
      <MetaBar meta={meta} onChange={setMeta} />
      <div className="fsm-body">
        <div className="fsm-canvas-area">
          <button className="btn primary fsm-add" data-testid="fsm-add-state" onClick={() => canvas.current?.addState()}>+ Add state</button>
          <ReactFlowProvider>
            <FsmCanvas meta={meta} onReady={onReady} onChange={onChange} onSelect={setSel} />
          </ReactFlowProvider>
        </div>
        <FsmInspector selection={selection} onStateChange={onStateChange} onTransitionChange={onTransitionChange} onDelete={onDelete} issues={issues} />
        <div className="fsm-yaml-rail">
          <AssistPanel current={spec} onDraft={setProposalYaml} />
          <YamlPanel
            yaml={yaml}
            onLoad={(s) => { setMeta({ name: s.name, unit: s.unit, version: s.version, stateNode: s.stateNode }); patchAndReload(s); }}
            pasteValue={proposalYaml}
            onPasteChange={setProposalYaml}
          />
        </div>
      </div>
    </div>
  );
}

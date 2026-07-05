// ComposeView = the operator's compose surface, the 04 tab. It owns all shared state and wires the four
// children together inside the single <ReactFlowProvider> Canvas requires (Canvas uses useReactFlow):
//
//   Palette (drag source) ─┐
//   Canvas (graph host) ───┼─► currentDef + validateResult + selectedNode  ─► Inspector (params + save)
//   Inspector ─────────────┘                                                ─► RunPanel (run + poll)
//   RunPanel ─► nodeStates ─► Canvas (colors nodes via .ns-*)
//
// PARAM-SYNC DECISION (per plan): Canvas owns its nodes internally and only emits a derived WorkflowDef
// via onGraphChange — it does NOT accept controlled params. Rather than reach into Canvas state, we keep
// `paramOverrides: Record<nodeId, Record<name,value>>` here. The Inspector writes edits into it, and we
// merge overrides into `currentDef` before save AND into the Inspector's displayed node data. The merge
// is keyed by nodeId; orphaned overrides (node deleted) are harmless — they only apply to matching steps.
import { useCallback, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeStates, PaletteCard, ValidateResult, WorkflowDef } from "../../types";
import { saveWorkflow } from "../../api";
import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { RunPanel } from "./RunPanel";
import type { BlockNodeData } from "./graph";

type ParamOverrides = Record<string, Record<string, string>>;

export function ComposeView() {
  const [palette, setPalette] = useState<PaletteCard[]>([]);
  const [name, setName] = useState("my-workflow");
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [currentDef, setCurrentDef] = useState<WorkflowDef | null>(null);
  const [saved, setSaved] = useState<{ name: string; version: string } | null>(null);
  const [nodeStates, setNodeStates] = useState<NodeStates>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [paramOverrides, setParamOverrides] = useState<ParamOverrides>({});

  // --- Memoized Canvas callbacks (watch-item): stable identities keep Canvas's debounce effect from
  //     thrashing. They only touch setState, which is referentially stable.
  const onValidate = useCallback((r: ValidateResult | null) => setValidateResult(r), []);
  const onGraphChange = useCallback((def: WorkflowDef) => setCurrentDef(def), []);
  const onSelectNode = useCallback((id: string | null) => setSelectedNodeId(id), []);

  const onLoaded = useCallback((cards: PaletteCard[]) => setPalette(cards), []);

  const liveNodeCount = currentDef?.steps.length ?? 0;

  // Merge param overrides into the def emitted by Canvas — this is the source of truth for save.
  const mergedDef = useMemo<WorkflowDef | null>(() => {
    if (!currentDef) return null;
    return {
      ...currentDef,
      steps: currentDef.steps.map((s) => {
        const ov = s.id ? paramOverrides[s.id] : undefined;
        return ov ? { ...s, params: { ...s.params, ...ov } } : s;
      }),
    };
  }, [currentDef, paramOverrides]);

  // Reconstruct the selected node's BlockNodeData from the merged def + palette (Canvas only lifts the id).
  const selected = useMemo<{ id: string; data: BlockNodeData } | null>(() => {
    if (!selectedNodeId || !mergedDef) return null;
    const step = mergedDef.steps.find((s) => (s.id ?? "") === selectedNodeId);
    if (!step) return null;
    const card = palette.find((c) => c.id === step.blockId) ?? null;
    return {
      id: selectedNodeId,
      data: {
        card,
        blockId: step.blockId,
        pinnedVersion: step.pinnedVersion,
        params: step.params,
      },
    };
  }, [selectedNodeId, mergedDef, palette]);

  const onParamChange = useCallback((nodeId: string, paramName: string, value: string) => {
    setParamOverrides((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], [paramName]: value },
    }));
  }, []);

  const onSave = useCallback(
    async (version: string) => {
      if (!mergedDef) throw new Error("Graph is empty.");
      const res = await saveWorkflow({ ...mergedDef, name }, version);
      setSaved(res);
      return res;
    },
    [mergedDef, name],
  );

  return (
    <ReactFlowProvider>
      <div className="compose-grid">
        <div className="palette-rail">
          <Palette onLoaded={onLoaded} />
        </div>

        <div className="canvas-area">
          <div className="canvas-hint">블록의 오른쪽 점을 다른 블록의 왼쪽 점으로 끌어 연결하세요 · Drag a block's right dot to another block's left dot to connect</div>
          <Canvas
            palette={palette}
            name={name}
            nodeStates={nodeStates}
            onValidate={onValidate}
            onGraphChange={onGraphChange}
            onSelectNode={onSelectNode}
          />
        </div>

        <Inspector
          selected={selected}
          onParamChange={onParamChange}
          validateResult={validateResult}
          liveNodeCount={liveNodeCount}
          name={name}
          onNameChange={setName}
          onSave={onSave}
        />

        <RunPanel saved={saved} onNodeStates={setNodeStates} />
      </div>
    </ReactFlowProvider>
  );
}

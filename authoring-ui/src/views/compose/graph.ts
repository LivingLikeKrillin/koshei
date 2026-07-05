import type { Node, Edge } from "@xyflow/react";
import type { WorkflowDef, WorkflowStep, PaletteCard } from "../../types";

// A canvas node carries the PaletteCard (for ports/params rendering) + the step's blockId/version/params.
export interface BlockNodeData {
  card: PaletteCard | null;     // null until palette resolves; ports come from here
  blockId: string;
  pinnedVersion: string;
  params: Record<string, string>;
  [key: string]: unknown;       // React Flow node data is an index type
}

/** WorkflowDef -> React Flow nodes/edges. Positions are a simple left-to-right layout (layout-only). */
export function toGraph(def: WorkflowDef, palette: PaletteCard[] = []): { nodes: Node<BlockNodeData>[]; edges: Edge[] } {
  const byId = new Map(palette.map((c) => [c.id, c]));
  // Kotlin WorkflowStep.id is nullable; the compiler falls back to "s$index", so mirror that here.
  const stepId = (s: WorkflowStep, i: number): string => s.id ?? `s${i}`;
  const nodes: Node<BlockNodeData>[] = def.steps.map((s, i) => ({
    id: stepId(s, i),
    type: "block",
    position: { x: 60 + i * 220, y: 80 + (i % 2) * 140 },
    data: { card: byId.get(s.blockId) ?? null, blockId: s.blockId, pinnedVersion: s.pinnedVersion, params: { ...s.params } },
  }));
  const edges: Edge[] = [];
  def.steps.forEach((s, i) => {
    const targetId = stepId(s, i);
    for (const [inputName, ref] of Object.entries(s.wiring)) {
      const dot = ref.lastIndexOf(".");
      if (dot < 0) continue; // skip a dot-free/malformed ref rather than emit a corrupt edge
      const sourceId = ref.slice(0, dot);
      const sourceHandle = ref.slice(dot + 1);
      edges.push({ id: `${sourceId}.${sourceHandle}->${targetId}.${inputName}`, source: sourceId, target: targetId, sourceHandle, targetHandle: inputName });
    }
  });
  return { nodes, edges };
}

/** React Flow nodes/edges -> WorkflowDef. Drops positions (layout-only). */
export function toWorkflowDef(name: string, nodes: Node<BlockNodeData>[], edges: Edge[]): WorkflowDef {
  const steps: WorkflowStep[] = nodes.map((n) => {
    const wiring: Record<string, string> = {};
    for (const e of edges) {
      if (e.target === n.id && e.targetHandle && e.sourceHandle) wiring[e.targetHandle] = `${e.source}.${e.sourceHandle}`;
    }
    return { blockId: n.data.blockId, pinnedVersion: n.data.pinnedVersion, id: n.id, params: { ...n.data.params }, wiring };
  });
  return { name, steps };
}

// Canvas = the React Flow host. Operators drag palette blocks here (drop → node), wire port-to-port
// (connect → edge), and see live validation + run-state coloring. All node data is BlockNodeData; the
// derived WorkflowDef + validate verdict are pushed up to ComposeView via callbacks. The enclosing
// <ReactFlowProvider> is added by ComposeView (Chunk 5) — this component only uses the hooks.
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import type { Node, Edge, Connection } from "@xyflow/react";
// NOTE: the React Flow base stylesheet is imported in main.tsx BEFORE styles.css so our
// overrides (acid-lime edges, hidden attribution, handle size) win the cascade. Do not
// re-import it here — that would reload the base CSS after our overrides and undo them.

import type { PaletteCard, NodeStates, ValidateResult, WorkflowDef } from "../../types";
import { validateWorkflow } from "../../api";
import { BlockNode } from "./BlockNode";
import { toWorkflowDef, type BlockNodeData } from "./graph";
import { offsetToAvoidOverlap } from "./dropLayout";
import { DRAG_MIME } from "./Palette";

export interface CanvasProps {
  palette: PaletteCard[];
  name: string;
  nodeStates: NodeStates;
  onValidate?: (r: ValidateResult | null) => void;
  onSelectNode?: (nodeId: string | null) => void;
  onGraphChange?: (def: WorkflowDef) => void;
}

// Register custom node type once (RF warns if this object identity changes each render).
const nodeTypes = { block: BlockNode };

// Pick the next free `s<n>` id given the existing node ids (explicit ids == compiler nodeId, spec §3.5).
function nextStepId(nodes: Node<BlockNodeData>[]): string {
  const used = new Set(nodes.map((n) => n.id));
  for (let i = 0; ; i++) {
    const id = `s${i}`;
    if (!used.has(id)) return id;
  }
}

export function Canvas({
  palette,
  name,
  nodeStates,
  onValidate,
  onSelectNode,
  onGraphChange,
}: CanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<BlockNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge(c, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      let payload: { id: string; version: string };
      try {
        payload = JSON.parse(raw);
      } catch {
        return; // malformed drag payload — ignore rather than crash
      }
      const card = palette.find((c) => c.id === payload.id) ?? null;
      const position = offsetToAvoidOverlap(screenToFlowPosition({ x: e.clientX, y: e.clientY }), nodes);
      setNodes((nds) => {
        const id = nextStepId(nds);
        const node: Node<BlockNodeData> = {
          id,
          type: "block",
          position,
          data: { card, blockId: payload.id, pinnedVersion: payload.version, params: {} },
        };
        return [...nds, node];
      });
    },
    [palette, screenToFlowPosition, setNodes, nodes],
  );

  const onNodeClick = useCallback(
    (_e: React.MouseEvent, node: Node) => onSelectNode?.(node.id),
    [onSelectNode],
  );
  const onPaneClick = useCallback(() => onSelectNode?.(null), [onSelectNode]);

  // Graph-change emits IMMEDIATELY; only the validate call stays debounced. A cancellation flag drops
  // stale responses. Empty graph short-circuits to onValidate(null) without hitting the API.
  const validateRef = useRef(0);
  useEffect(() => {
    const def = toWorkflowDef(name, nodes, edges);
    onGraphChange?.(def);                    // IMMEDIATE — node presence must not lag behind the debounce (F04)
    if (nodes.length === 0) { onValidate?.(null); return; }
    const timer = setTimeout(() => {
      const seq = ++validateRef.current;
      validateWorkflow(def)
        .then((result) => { if (seq === validateRef.current) onValidate?.(result); })
        .catch(() => { if (seq === validateRef.current) onValidate?.({ valid: false, diagnostics: ["Validation request failed"], nodeCount: nodes.length }); });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name]);

  // Re-fit the viewport after a node is added/removed so freshly-dropped blocks stay visible (F05).
  useEffect(() => {
    if (nodes.length > 0) fitView({ padding: 0.2, duration: 200 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  // Inject live run-state into a render-only copy of the nodes (don't mutate state).
  const renderNodes = useMemo<Node<BlockNodeData>[]>(
    () =>
      nodes.map((n) => {
        const state = nodeStates[n.id];
        if (!state) return n;
        return { ...n, data: { ...n.data, nodeState: state } };
      }),
    [nodes, nodeStates],
  );

  return (
    <ReactFlow
      data-testid="compose-canvas"
      nodes={renderNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
    >
      <Background variant={BackgroundVariant.Lines} gap={44} color="var(--line-soft)" />
      <Controls />
    </ReactFlow>
  );
}

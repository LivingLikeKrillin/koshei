// FsmCanvas = the React Flow host for the FSM editor. "Add state" appends a node; connecting two
// handles creates a transition edge; selection lifts the id to FsmView for the Inspector. A debounced
// change effect derives the FsmSpec (toSpec) + runs client-side structural validation (validateFsm)
// and pushes both up. The enclosing <ReactFlowProvider> is added by FsmView.
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { Node, Edge, Connection } from "@xyflow/react";
import { StateNode } from "./StateNode";
import { toGraph, toSpec, type StateNodeData, type FsmEdgeData, type FsmMeta } from "./fsmGraph";
import { validateFsm, type FsmIssue } from "./fsmValidate";
import type { FsmSpec } from "./fsmTypes";

const nodeTypes = { state: StateNode };

export interface FsmCanvasHandle {
  addState: () => void;
  loadSpec: (spec: FsmSpec) => void;
}

export interface FsmCanvasProps {
  meta: FsmMeta;
  // Register imperative actions (add state / load spec) with the parent.
  onReady?: (h: FsmCanvasHandle) => void;
  onSelect?: (sel: { kind: "state"; id: string } | { kind: "transition"; id: string } | null) => void;
  onChange?: (spec: FsmSpec, issues: FsmIssue[]) => void;
}

// Next free n<n> node id.
function nextNodeId(nodes: Node<StateNodeData>[]): string {
  const used = new Set(nodes.map((n) => n.id));
  for (let i = 0; ; i++) if (!used.has(`n${i}`)) return `n${i}`;
}
function nextTransitionId(edges: Edge[]): string {
  const used = new Set(edges.map((e) => e.id));
  for (let i = 0; ; i++) if (!used.has(`t${i}`)) return `t${i}`;
}

export function FsmCanvas({ meta, onReady, onSelect, onChange }: FsmCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<StateNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<FsmEdgeData>>([]);

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          { ...c, id: nextTransitionId(eds), label: "(reactive)", className: "fsm-edge-field", data: { command: null, driver: "field" } },
          eds,
        ),
      ),
    [setEdges],
  );

  // Imperative handle: add a fresh state node / load a whole spec into the canvas.
  useEffect(() => {
    onReady?.({
      addState: () =>
        setNodes((nds) => {
          const id = nextNodeId(nds);
          const i = nds.length;
          return [
            ...nds,
            { id, type: "state", position: { x: 60 + i * 220, y: 80 + (i % 2) * 140 }, data: { stateId: `S${i}`, code: i } },
          ];
        }),
      loadSpec: (spec: FsmSpec) => {
        const g = toGraph(spec);
        setNodes(g.nodes);
        setEdges(g.edges);
      },
    });
  }, [onReady, setNodes, setEdges]);

  const onNodeClick = useCallback((_e: React.MouseEvent, n: Node) => onSelect?.({ kind: "state", id: n.id }), [onSelect]);
  const onEdgeClick = useCallback((_e: React.MouseEvent, ed: Edge) => onSelect?.({ kind: "transition", id: ed.id }), [onSelect]);
  const onPaneClick = useCallback(() => onSelect?.(null), [onSelect]);

  // Debounced derive+validate. Pure — no network. Pushes spec + issues up.
  const metaRef = useRef(meta);
  metaRef.current = meta;
  useEffect(() => {
    const timer = setTimeout(() => {
      const spec = toSpec(metaRef.current, nodes, edges);
      onChange?.(spec, validateFsm(spec));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, meta]);

  // Inject invalid-highlight flags (recomputed from validation) into render-only copies.
  const issues = useMemo(() => validateFsm(toSpec(meta, nodes, edges)), [meta, nodes, edges]);
  const badStateIds = useMemo(() => new Set(issues.map((i) => i.stateId).filter(Boolean) as string[]), [issues]);
  const badTransIds = useMemo(() => new Set(issues.map((i) => i.transitionId).filter(Boolean) as string[]), [issues]);

  const renderNodes = useMemo<Node<StateNodeData>[]>(
    () => nodes.map((n) => (badStateIds.has(n.data.stateId) ? { ...n, data: { ...n.data, invalid: true } } : n)),
    [nodes, badStateIds],
  );
  const renderEdges = useMemo<Edge<FsmEdgeData>[]>(
    () => edges.map((e) => (badTransIds.has(e.id) ? { ...e, className: `${e.className ?? ""} fsm-invalid`.trim() } : e)),
    [edges, badTransIds],
  );

  return (
    <ReactFlow
      data-testid="fsm-canvas"
      nodes={renderNodes}
      edges={renderEdges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      deleteKeyCode={null}
      fitView
    >
      <Background variant={BackgroundVariant.Lines} gap={44} color="var(--line-soft)" />
      <Controls />
    </ReactFlow>
  );
}

// Custom React Flow node for an FSM state — shows the logical id + numeric state code, with
// source+target handles so a transition edge can start/end anywhere on the node. `data.invalid`
// (injected by FsmCanvas) toggles the red highlight. Registered as nodeTypes.state.
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { StateNodeData } from "./fsmGraph";

function StateNodeImpl({ data }: NodeProps<Node<StateNodeData>>) {
  const invalid = data.invalid === true;
  return (
    <div className={"fsm-node" + (invalid ? " fsm-invalid" : "")}>
      <Handle type="target" position={Position.Left} />
      <div className="fsm-node-id">{data.stateId}</div>
      <div className="fsm-node-code">code {data.code}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const StateNode = memo(StateNodeImpl);

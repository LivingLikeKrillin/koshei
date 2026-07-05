// Custom React Flow node — renders OUR card design (title + version + risk + ports), colored by run
// state. Purely presentational: all data arrives via node `data` (BlockNodeData); the Canvas injects
// `data.nodeState` on each poll. Registered as nodeTypes.block.
import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { BlockNodeData } from "./graph";
import { RiskBadge } from "../../ui";

function BlockNodeImpl({ data }: NodeProps<Node<BlockNodeData>>) {
  const card = data.card;
  // nodeState lives on the [key:string]: unknown index — read defensively (Canvas may not set it).
  const nodeState = (data.nodeState as string | undefined) ?? "pending";
  const title = card?.displayName || data.blockId;

  return (
    <div className={"rf-node ns-" + String(nodeState).toLowerCase()} title={`${data.blockId}@${data.pinnedVersion}`}>
      {/* Input handles (target, left) — one per declared input port */}
      {card?.inputs.map((p) => (
        <Handle
          key={`in-${p.name}`}
          type="target"
          position={Position.Left}
          id={p.name}
          title={p.label || p.name}
        />
      ))}

      <div className="rn-title">{title}</div>
      {card && <RiskBadge risk={card.risk} />}

      {/* Output handles (source, right) — one per declared output port */}
      {card?.outputs.map((p) => (
        <Handle
          key={`out-${p.name}`}
          type="source"
          position={Position.Right}
          id={p.name}
          title={p.label || p.name}
        />
      ))}
    </div>
  );
}

export const BlockNode = memo(BlockNodeImpl);

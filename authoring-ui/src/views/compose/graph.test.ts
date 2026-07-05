import { describe, it, expect } from "vitest";
import { toGraph, toWorkflowDef } from "./graph";
import type { WorkflowDef } from "../../types";

const diamond: WorkflowDef = {
  name: "diamond",
  steps: [
    { blockId: "db.read", pinnedVersion: "1.0.0", id: "src", params: {}, wiring: {} },
    { blockId: "transform.map", pinnedVersion: "1.0.0", id: "b", params: {}, wiring: { rows: "src.rows" } },
    { blockId: "transform.map", pinnedVersion: "1.0.0", id: "c", params: {}, wiring: { rows: "src.rows" } },
    { blockId: "merge", pinnedVersion: "1.0.0", id: "join", params: {}, wiring: { left: "b.rows", right: "c.rows" } },
    { blockId: "db.upsert", pinnedVersion: "1.2.0", id: "sink", params: { table: "target_rows" }, wiring: { rows: "join.out" } },
  ],
};

describe("graph round-trip", () => {
  it("WorkflowDef -> graph -> WorkflowDef is identity", () => {
    const { nodes, edges } = toGraph(diamond);
    expect(nodes).toHaveLength(5);
    // 5 wires: b←src.rows, c←src.rows, join.left←b.rows, join.right←c.rows, sink.rows←join.out
    expect(edges).toHaveLength(5);
    const back = toWorkflowDef(diamond.name, nodes, edges);
    expect(back).toEqual(diamond);
  });

  it("an edge encodes inputName + upstream output as wiring", () => {
    const { edges } = toGraph(diamond);
    const joinLeft = edges.find((e) => e.target === "join" && e.targetHandle === "left");
    expect(joinLeft?.source).toBe("b");
    expect(joinLeft?.sourceHandle).toBe("rows");
  });
});

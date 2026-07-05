import { describe, it, expect } from "vitest";
import { offsetToAvoidOverlap } from "./dropLayout";

describe("offsetToAvoidOverlap (F05)", () => {
  it("returns the position unchanged when clear of existing nodes", () => {
    expect(offsetToAvoidOverlap({ x: 500, y: 300 }, [{ position: { x: 100, y: 100 } }])).toEqual({ x: 500, y: 300 });
  });
  it("nudges away when within the overlap threshold of an existing node", () => {
    const out = offsetToAvoidOverlap({ x: 100, y: 100 }, [{ position: { x: 100, y: 100 } }]);
    expect(out).not.toEqual({ x: 100, y: 100 });
    expect(out.x).toBeGreaterThan(100); expect(out.y).toBeGreaterThan(100);
  });
  it("cascades past multiple stacked nodes to a clear spot", () => {
    const nodes = [{ position: { x: 100, y: 100 } }, { position: { x: 140, y: 140 } }];
    const out = offsetToAvoidOverlap({ x: 100, y: 100 }, nodes);
    const clash = nodes.some((n) => Math.abs(n.position.x - out.x) < 60 && Math.abs(n.position.y - out.y) < 60);
    expect(clash).toBe(false);
  });
});

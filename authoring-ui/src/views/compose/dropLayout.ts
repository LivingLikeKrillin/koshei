export interface XY { x: number; y: number; }

/** F05: if a drop lands within THRESHOLD px of an existing node, cascade it by DELTA until clear, so
 *  consecutive drops fan out instead of stacking. Pure; bounded iteration. */
const THRESHOLD = 60;
const DELTA = 40;

export function offsetToAvoidOverlap(pos: XY, nodes: { position: XY }[]): XY {
  let out = { ...pos };
  const clashes = (p: XY) => nodes.some((n) => Math.abs(n.position.x - p.x) < THRESHOLD && Math.abs(n.position.y - p.y) < THRESHOLD);
  for (let i = 0; i < 50 && clashes(out); i++) out = { x: out.x + DELTA, y: out.y + DELTA };
  return out;
}

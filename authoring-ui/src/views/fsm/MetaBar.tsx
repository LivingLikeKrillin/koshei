// Top-of-editor form for the spec's scalar metadata (name/unit/version/stateNode).
import type { FsmMeta } from "./fsmGraph";

export function MetaBar({ meta, onChange }: { meta: FsmMeta; onChange: (m: FsmMeta) => void }) {
  const set = (k: keyof FsmMeta) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...meta, [k]: e.target.value });
  const field = (k: keyof FsmMeta, label: string, testid: string) => (
    <div className="field">
      <label htmlFor={`fsm-meta-${k}`}>{label}</label>
      <input id={`fsm-meta-${k}`} data-testid={testid} className="mono" type="text" value={meta[k]} onChange={set(k)} />
    </div>
  );
  return (
    <div className="fsm-metabar">
      {field("name", "name", "fsm-name")}
      {field("unit", "unit", "fsm-unit")}
      {field("version", "version (blank = legacy)", "fsm-version")}
      {field("stateNode", "stateNode", "fsm-statenode")}
    </div>
  );
}

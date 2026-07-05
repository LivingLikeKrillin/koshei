import type { IoManifest } from "../types";

interface PortRowProps {
  port: IoManifest;
  // 1-based position, for the remove aria-label (display only).
  index: number;
  // Stable per-field id base (e.g. `${uid}-${key}${stableUid}`), kept byte-identical
  // to the pre-extraction markup so htmlFor/id pairing survives reorder/removal.
  idBase: string;
  // singular noun for the remove aria-label ("input" | "output").
  kindLabel: string;
  onChange: (p: Partial<IoManifest>) => void;
  onRemove: () => void;
}

// One input/output port row (name/type/label) with a trailing remove button.
export function PortRow({ port: p, index, idBase, kindLabel, onChange, onRemove }: PortRowProps) {
  return (
    <div className="field-row port-row">
      <div className="field">
        <label htmlFor={`${idBase}-name`}>Name</label>
        <input
          id={`${idBase}-name`}
          className="mono"
          type="text"
          value={p.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idBase}-type`}>Type</label>
        <input
          id={`${idBase}-type`}
          className="mono"
          type="text"
          value={p.type}
          onChange={(e) => onChange({ type: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idBase}-label`}>Label</label>
        <input
          id={`${idBase}-label`}
          type="text"
          value={p.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>
      <button
        className="icon-btn"
        aria-label={`remove ${kindLabel} #${index}`}
        onClick={onRemove}
      >
        ✕
      </button>
    </div>
  );
}

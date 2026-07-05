import type { ParamManifest } from "../types";
import { WIDGETS } from "../types";

interface ParamRowProps {
  param: ParamManifest;
  // 1-based position, for the "PARAM #n" tag + aria-labels (display only).
  index: number;
  // Stable per-field id base (e.g. `${uid}-p${stableUid}`) so htmlFor/id pairing
  // survives row reorder/removal. Kept byte-identical to the pre-extraction markup.
  idBase: string;
  onChange: (p: Partial<ParamManifest>) => void;
  onRemove: () => void;
}

// One param's row of fields (name/type/required/label/help/default/widget/enumValues).
export function ParamRow({ param: p, index, idBase, onChange, onRemove }: ParamRowProps) {
  return (
    <div className="rep">
      <div className="rep-head">
        <span className="tag">PARAM #{index}</span>
        <button
          className="icon-btn"
          aria-label={`remove param #${index}`}
          onClick={onRemove}
        >
          ✕ remove
        </button>
      </div>
      <div className="field-row">
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
          <label htmlFor={`${idBase}-label`}>
            Label <span className="muted">(C3)</span>
          </label>
          <input
            id={`${idBase}-label`}
            type="text"
            placeholder="Table"
            value={p.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idBase}-help`}>Help</label>
          <input
            id={`${idBase}-help`}
            type="text"
            value={p.help}
            onChange={(e) => onChange({ help: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idBase}-default`}>Default</label>
          <input
            id={`${idBase}-default`}
            className="mono"
            type="text"
            value={p.default ?? ""}
            onChange={(e) => onChange({ default: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idBase}-widget`}>Widget</label>
          <select
            id={`${idBase}-widget`}
            className="mono"
            value={p.widget ?? ""}
            onChange={(e) => onChange({ widget: e.target.value || null })}
          >
            <option value="">(none)</option>
            {WIDGETS.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>
      {p.widget === "select" && (
        <div className="field">
          <label htmlFor={`${idBase}-enum`}>
            Enum values <span className="muted">(C5 · comma-separated)</span>
          </label>
          <input
            id={`${idBase}-enum`}
            className="mono"
            type="text"
            placeholder="fast, safe"
            value={p.enumValues.join(", ")}
            onChange={(e) =>
              onChange({
                enumValues: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      )}
      <label className="checkline">
        <input
          type="checkbox"
          checked={p.required}
          onChange={(e) => onChange({ required: e.target.checked })}
        />
        required
      </label>
    </div>
  );
}

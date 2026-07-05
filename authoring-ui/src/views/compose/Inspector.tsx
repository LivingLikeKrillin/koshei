// Inspector = the right rail of the compose surface. Three stacked concerns:
//   1) Param editor for the currently-selected block (binds each ParamCard → data.params[name]).
//   2) Live validation verdict (the debounced POST /workflows/validate result from Canvas).
//   3) Save = deploy form (name + version → POST /workflows?version=).
// It owns NO graph state; param edits are written back via onParamChange and the save is delegated.
//
// NOTE on ParamRow reuse: ../ParamRow edits a ParamManifest *definition* (name/type/widget/...) for the
// contract author. Here we instead need to fill in a param *value* for an already-defined ParamCard.
// Different shape, different intent — so a minimal inline value editor is the correct call, not a reuse.
import { useState } from "react";
import type { BlockNodeData } from "./graph";
import type { ParamCard, ValidateResult } from "../../types";
import { ApiError } from "../../api";

export interface InspectorProps {
  // The selected node's id + its BlockNodeData (or null when nothing is selected).
  selected: { id: string; data: BlockNodeData } | null;
  // Write an edited param value back into the selected node's data.params.
  onParamChange: (nodeId: string, paramName: string, value: string) => void;
  // Live compile verdict from Canvas's debounced validate (null = empty graph / not yet run).
  validateResult: ValidateResult | null;
  // Current number of nodes on the canvas (emitted immediately, ahead of the debounced verdict).
  liveNodeCount: number;
  // Workflow name (lifted to ComposeView) + setter.
  name: string;
  onNameChange: (name: string) => void;
  // Save = deploy. Resolves with the persisted {name,version}; throws ApiError(400, ValidateResult) on reject.
  onSave: (version: string) => Promise<{ name: string; version: string }>;
}

function ParamField({
  param,
  value,
  onChange,
}: {
  param: ParamCard;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = param.label || param.name;
  const id = `insp-param-${param.name}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {param.required && <span className="req"> *</span>}
      </label>
      {param.widget === "select" ? (
        <select id={id} className="mono" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">(select)</option>
          {param.enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className="mono"
          type={param.widget === "number" ? "number" : "text"}
          value={value}
          placeholder={param.default ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {param.help && <div className="pc-desc">{param.help}</div>}
    </div>
  );
}

export function Inspector({
  selected,
  onParamChange,
  validateResult,
  liveNodeCount,
  name,
  onNameChange,
  onSave,
}: InspectorProps) {
  const [version, setVersion] = useState("1.0.0");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ name: string; version: string } | null>(null);
  const [saveErr, setSaveErr] = useState<string[] | null>(null);

  const invalid = !validateResult || !validateResult.valid;

  async function handleSave() {
    setSaving(true);
    setSaved(null);
    setSaveErr(null);
    try {
      const res = await onSave(version);
      setSaved(res);
    } catch (e) {
      if (e instanceof ApiError) {
        const body = e.body as ValidateResult | null | undefined;
        if (body && Array.isArray(body.diagnostics)) {
          setSaveErr(body.diagnostics.length ? body.diagnostics : [`${e.status} rejected`]);
        } else {
          setSaveErr([`${e.status} ${e.message}`]);
        }
      } else {
        setSaveErr([e instanceof Error ? e.message : String(e)]);
      }
    } finally {
      setSaving(false);
    }
  }

  const card = selected?.data.card ?? null;
  const params = card?.params ?? [];

  return (
    <div className="inspector-rail">
      {/* ---- Param editor ---- */}
      <div className="panel">
        <div className="panel-head">
          <span>BLOCK PARAMS</span>
        </div>
        <div className="inspector-section">
          {!selected && <div className="empty">Select a block.</div>}
          {selected && card && params.length === 0 && (
            <div className="empty">This block has no params.</div>
          )}
          {selected && !card && (
            <div className="empty">Loading the palette card — can't show params yet.</div>
          )}
          {selected &&
            card &&
            params.map((p) => (
              <ParamField
                key={p.name}
                param={p}
                value={selected.data.params[p.name] ?? ""}
                onChange={(v) => onParamChange(selected.id, p.name, v)}
              />
            ))}
        </div>
      </div>

      {/* ---- Validation verdict ---- */}
      <div className="panel">
        <div className="panel-head">
          <span>VALIDATION</span>
          {validateResult && (
            <span className={`risk ${validateResult.valid ? "green" : "red"}`}>
              <span className="led" />
              {validateResult.valid ? "VALID" : "INVALID"}
            </span>
          )}
        </div>
        <div className="inspector-section tight">
          {liveNodeCount === 0 && <div className="empty">Graph is empty — add a block.</div>}
          {liveNodeCount > 0 && !validateResult && <div className="empty">Checking…</div>}
          {liveNodeCount > 0 && validateResult && (
            <>
              <div className="pc-id">nodeCount = {validateResult.nodeCount}</div>
              {validateResult.diagnostics.length === 0
                ? <div className="banner ok">No diagnostics — compile passed</div>
                : <ul className="list-plain">{validateResult.diagnostics.map((d, i) => <li key={i} className="banner err">{d}</li>)}</ul>}
            </>
          )}
        </div>
      </div>

      {/* ---- Save = deploy ---- */}
      <div className="panel save-panel">
        <div className="panel-head">
          <span>SAVE (DEPLOY)</span>
        </div>
        <div className="inspector-section">
          <div className="field">
            <label htmlFor="insp-wf-name">Workflow name</label>
            <input
              id="insp-wf-name"
              data-testid="wf-name"
              className="mono"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="insp-wf-version">Version</label>
            <input
              id="insp-wf-version"
              className="mono"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </div>
          <button
            className="btn primary"
            data-testid="save-button"
            disabled={saving || invalid}
            title={invalid ? "The graph must be valid before you can save" : undefined}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Save (deploy)"}
          </button>
          {saved && (
            <div className="banner ok">
              Deployed: {saved.name} @{saved.version}
            </div>
          )}
          {saveErr &&
            saveErr.map((m, i) => (
              <div key={i} className="banner err">
                {m}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

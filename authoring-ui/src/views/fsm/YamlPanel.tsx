// YamlPanel = the Git bridge. Top: paste area + Load (parse -> canvas). Bottom: the live-emitted
// house-style YAML + Copy. Malformed paste is fail-safe: it shows an error and leaves the canvas alone.
import { useState } from "react";
import { parseFsmYaml } from "./fsmYaml";
import type { FsmSpec } from "./fsmTypes";

export function YamlPanel({
  yaml,
  onLoad,
  pasteValue,
  onPasteChange,
}: {
  yaml: string;
  onLoad: (spec: FsmSpec) => void;
  /** Controllable paste text (e.g. an assist draft). Omit to keep YamlPanel's internal state. */
  pasteValue?: string;
  onPasteChange?: (v: string) => void;
}) {
  const [internalPaste, setInternalPaste] = useState("");
  const paste = pasteValue !== undefined ? pasteValue : internalPaste;
  const setPaste = onPasteChange !== undefined ? onPasteChange : setInternalPaste;
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    try {
      onLoad(parseFsmYaml(paste));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e)); // fail-safe: canvas untouched
    }
  };
  const copy = () => {
    if (!navigator.clipboard) return; // only signal "Copied" when the write actually happens
    void navigator.clipboard.writeText(yaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="fsm-yaml-rail">
      <div className="panel">
        <div className="panel-head"><span>LOAD YAML</span></div>
        <div className="inspector-section">
          <textarea data-testid="fsm-yaml-in" className="mono fsm-yaml-textarea" value={paste}
            placeholder="Paste model/fsm/*.yaml here…" onChange={(e) => setPaste(e.target.value)} />
          <button className="btn primary" data-testid="fsm-load" onClick={load}>Load into canvas</button>
          {err && <div className="banner err" data-testid="fsm-yaml-err">{err}</div>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <span>SPEC YAML</span>
          <button className="btn" data-testid="fsm-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <div className="inspector-section">
          <pre className="mono fsm-yaml-out" data-testid="fsm-yaml-out">{yaml}</pre>
        </div>
      </div>
    </div>
  );
}

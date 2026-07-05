import { useEffect, useId, useRef, useState } from "react";
import { validate } from "../api";
import type {
  AuthoredContract,
  IoManifest,
  ParamManifest,
  ValidationResponse,
} from "../types";
import {
  CATEGORIES,
  COMP_KIND,
  IDEMPOTENCY,
  REVERSIBILITY,
  SIDE_EFFECTS,
} from "../types";
import { ParamRow } from "./ParamRow";
import { PortRow } from "./PortRow";
import { ValidationInspector } from "./ValidationInspector";

interface Props {
  contract: AuthoredContract;
  onChange: (c: AuthoredContract) => void;
  onProceedToPublish: () => void;
}

const DEBOUNCE_MS = 450;

// Immutable patch helper keeps the controlled form terse.
function patch<T extends object>(obj: T, p: Partial<T>): T {
  return { ...obj, ...p };
}

export function ContractEditor({ contract, onChange, onProceedToPublish }: Props) {
  const uid = useId(); // prefix for htmlFor/id pairing (a11y)
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);

  // Debounced live validation against POST /api/contracts/validate.
  // The cancelled flag both guards against post-unmount setState and discards a stale in-flight
  // response when `contract` changes again before the previous fetch resolves.
  useEffect(() => {
    let cancelled = false;
    setValidating(true);
    const id = window.setTimeout(async () => {
      try {
        const r = await validate(contract);
        if (!cancelled) {
          setResult(r);
          setNetError(null);
        }
      } catch (e) {
        // A 400 from a malformed contract body (e.g. bad enum) surfaces here — show it, don't crash.
        if (!cancelled) {
          setNetError(e instanceof Error ? e.message : String(e));
          setResult(null);
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [contract]);

  const set = (p: Partial<AuthoredContract>) => onChange(patch(contract, p));

  // ---- stable UI-only row keys ---------------------------------------------
  // Array-index keys break focus/value when a middle row is removed. We keep parallel uid lists
  // (UI-only — they never enter the serialized AuthoredContract) and mutate them in lockstep with
  // add/remove so a row's identity survives reordering. If `contract` is swapped wholesale (e.g. a
  // draft loaded from BlockBrowse), `syncIds` re-seeds the list to match the new length.
  const uidSeq = useRef(0);
  const rowIds = useRef<{ params: number[]; inputs: number[]; outputs: number[] }>({
    params: [],
    inputs: [],
    outputs: [],
  });
  const nextUid = () => ++uidSeq.current;
  const syncIds = (key: "params" | "inputs" | "outputs", len: number): number[] => {
    const ids = rowIds.current[key];
    if (ids.length !== len) {
      // Length drift => the array was replaced (not edited through add/rm); re-seed fresh uids.
      rowIds.current[key] = Array.from({ length: len }, () => nextUid());
    }
    return rowIds.current[key];
  };
  const paramIds = syncIds("params", contract.params.length);
  const inputIds = syncIds("inputs", contract.inputs.length);
  const outputIds = syncIds("outputs", contract.outputs.length);
  const portIds = (key: "inputs" | "outputs") => (key === "inputs" ? inputIds : outputIds);

  // ---- params --------------------------------------------------------------
  const addParam = () => {
    rowIds.current.params = [...rowIds.current.params, nextUid()];
    set({
      params: [
        ...contract.params,
        { name: "", type: "string", required: false, label: "", help: "", default: null, widget: null, enumValues: [] },
      ],
    });
  };
  const setParam = (i: number, p: Partial<ParamManifest>) =>
    set({ params: contract.params.map((x, j) => (j === i ? patch(x, p) : x)) });
  const rmParam = (i: number) => {
    rowIds.current.params = rowIds.current.params.filter((_, j) => j !== i);
    set({ params: contract.params.filter((_, j) => j !== i) });
  };

  // ---- ports ---------------------------------------------------------------
  const addPort = (key: "inputs" | "outputs") => {
    rowIds.current[key] = [...rowIds.current[key], nextUid()];
    set({ [key]: [...contract[key], { name: "", type: "Record[]", label: "" }] } as Partial<AuthoredContract>);
  };
  const setPort = (key: "inputs" | "outputs", i: number, p: Partial<IoManifest>) =>
    set({ [key]: contract[key].map((x, j) => (j === i ? patch(x, p) : x)) } as Partial<AuthoredContract>);
  const rmPort = (key: "inputs" | "outputs", i: number) => {
    rowIds.current[key] = rowIds.current[key].filter((_, j) => j !== i);
    set({ [key]: contract[key].filter((_, j) => j !== i) } as Partial<AuthoredContract>);
  };

  return (
    <div className="editor">
      <div className="form-stack">
        {/* ---- Identity ---- */}
        <fieldset className="section">
          <legend>Identity</legend>
          <div className="section-body">
            <div className="field-row">
              <div className="field">
                <label htmlFor={`${uid}-id`}>
                  ID <span className="req">*</span>
                </label>
                <input
                  id={`${uid}-id`}
                  className="mono"
                  type="text"
                  placeholder="io.example.greet"
                  value={contract.id}
                  onChange={(e) => set({ id: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-version`}>
                  Version <span className="req">*</span>
                </label>
                <input
                  id={`${uid}-version`}
                  className="mono"
                  type="text"
                  placeholder="1.0.0"
                  value={contract.version}
                  onChange={(e) => set({ version: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-category`}>Category</label>
                <select
                  id={`${uid}-category`}
                  className="mono"
                  value={contract.category}
                  onChange={(e) => set({ category: e.target.value as AuthoredContract["category"] })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor={`${uid}-displayName`}>
                Display name <span className="req">*</span> <span className="muted">(C1)</span>
              </label>
              <input
                id={`${uid}-displayName`}
                type="text"
                placeholder="Greeting block"
                value={contract.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-description`}>
                Description <span className="req">*</span> <span className="muted">(C2)</span>
              </label>
              <textarea
                id={`${uid}-description`}
                placeholder="Describe what this block does in a sentence or two."
                value={contract.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-handler`}>
                Forward handler (FQCN) <span className="req">*</span>
              </label>
              <input
                id={`${uid}-handler`}
                className="mono"
                type="text"
                placeholder="io.example.GreetBlock"
                value={contract.forward.handler}
                onChange={(e) => set({ forward: { handler: e.target.value } })}
              />
            </div>
          </div>
        </fieldset>

        {/* ---- Params ---- */}
        <fieldset className="section">
          <legend>Params · presentation</legend>
          <div className="section-body">
            {contract.params.length === 0 && <span className="muted">No params.</span>}
            {contract.params.map((p, i) => (
              <ParamRow
                key={paramIds[i]}
                param={p}
                index={i + 1}
                idBase={`${uid}-p${paramIds[i]}`}
                onChange={(patchP) => setParam(i, patchP)}
                onRemove={() => rmParam(i)}
              />
            ))}
            <button className="icon-btn add-row" onClick={addParam}>
              + add param
            </button>
          </div>
        </fieldset>

        {/* ---- Ports ---- */}
        <fieldset className="section">
          <legend>Ports · inputs / outputs</legend>
          <div className="section-body">
            {(["inputs", "outputs"] as const).map((key) => (
              <div className="field" key={key}>
                <label>
                  {key} <span className="muted">(C4 · every port needs a label)</span>
                </label>
                {contract[key].length === 0 && <span className="muted">None.</span>}
                {contract[key].map((p, i) => (
                  <PortRow
                    key={portIds(key)[i]}
                    port={p}
                    index={i + 1}
                    idBase={`${uid}-${key}${portIds(key)[i]}`}
                    kindLabel={key === "inputs" ? "input" : "output"}
                    onChange={(patchP) => setPort(key, i, patchP)}
                    onRemove={() => rmPort(key, i)}
                  />
                ))}
                <button className="icon-btn add-row" onClick={() => addPort(key)}>
                  + add {key === "inputs" ? "input" : "output"}
                </button>
              </div>
            ))}
          </div>
        </fieldset>

        {/* ---- Semantics ---- */}
        <fieldset className="section">
          <legend>Execution semantics</legend>
          <div className="section-body">
            <div className="field-row">
              <div className="field">
                <label htmlFor={`${uid}-idemStrategy`}>Idempotency strategy</label>
                <select
                  id={`${uid}-idemStrategy`}
                  className="mono"
                  value={contract.idempotency.strategy}
                  onChange={(e) =>
                    set({
                      idempotency: {
                        ...contract.idempotency,
                        strategy: e.target.value as AuthoredContract["idempotency"]["strategy"],
                      },
                    })
                  }
                >
                  {IDEMPOTENCY.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-keyExpr`}>Key expression</label>
                <input
                  id={`${uid}-keyExpr`}
                  className="mono"
                  type="text"
                  value={contract.idempotency.keyExpression ?? ""}
                  onChange={(e) =>
                    set({
                      idempotency: {
                        ...contract.idempotency,
                        keyExpression: e.target.value || null,
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor={`${uid}-reversibility`}>Reversibility</label>
                <select
                  id={`${uid}-reversibility`}
                  className="mono"
                  value={contract.compensation.reversibility}
                  onChange={(e) =>
                    set({
                      compensation: {
                        ...contract.compensation,
                        reversibility: e.target.value as AuthoredContract["compensation"]["reversibility"],
                      },
                    })
                  }
                >
                  {REVERSIBILITY.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor={`${uid}-compKind`}>Compensation kind</label>
                <select
                  id={`${uid}-compKind`}
                  className="mono"
                  value={contract.compensation.kind}
                  onChange={(e) =>
                    set({
                      compensation: {
                        ...contract.compensation,
                        kind: e.target.value as AuthoredContract["compensation"]["kind"],
                      },
                    })
                  }
                >
                  {COMP_KIND.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor={`${uid}-retryMax`}>Retry · max attempts</label>
                <input
                  id={`${uid}-retryMax`}
                  className="mono"
                  type="number"
                  min={1}
                  value={contract.retry.maxAttempts}
                  onChange={(e) =>
                    set({ retry: { ...contract.retry, maxAttempts: Number(e.target.value) } })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-backoffInit`}>Backoff initial (ms)</label>
                <input
                  id={`${uid}-backoffInit`}
                  className="mono"
                  type="number"
                  min={0}
                  value={contract.retry.backoff.initialMs}
                  onChange={(e) =>
                    set({
                      retry: {
                        ...contract.retry,
                        backoff: { ...contract.retry.backoff, initialMs: Number(e.target.value) },
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor={`${uid}-backoffMax`}>Backoff max (ms)</label>
                <input
                  id={`${uid}-backoffMax`}
                  className="mono"
                  type="number"
                  min={0}
                  value={contract.retry.backoff.maxMs}
                  onChange={(e) =>
                    set({
                      retry: {
                        ...contract.retry,
                        backoff: { ...contract.retry.backoff, maxMs: Number(e.target.value) },
                      },
                    })
                  }
                />
              </div>
            </div>
            <div className="field">
              <label>Side effects</label>
              <div className="check-group">
                {SIDE_EFFECTS.map((se) => (
                  <label className="checkline" key={se}>
                    <input
                      type="checkbox"
                      checked={contract.sideEffects.includes(se)}
                      onChange={(e) => {
                        // Checking a real effect drops NONE; checking NONE clears the rest. Dedup.
                        let next: AuthoredContract["sideEffects"];
                        if (e.target.checked) {
                          next =
                            se === "NONE"
                              ? ["NONE"]
                              : [...contract.sideEffects.filter((x) => x !== "NONE"), se];
                        } else {
                          next = contract.sideEffects.filter((x) => x !== se);
                        }
                        set({ sideEffects: next.length ? Array.from(new Set(next)) : ["NONE"] });
                      }}
                    />
                    {se}
                  </label>
                ))}
              </div>
            </div>
            <label className="checkline">
              <input
                type="checkbox"
                checked={contract.human.requireApprovalBefore}
                onChange={(e) => set({ human: { requireApprovalBefore: e.target.checked } })}
              />
              require human approval before execution
            </label>
          </div>
        </fieldset>
      </div>

      {/* ---- Live inspector ---- */}
      <ValidationInspector
        contract={contract}
        result={result}
        validating={validating}
        netError={netError}
        onProceedToPublish={onProceedToPublish}
      />
    </div>
  );
}

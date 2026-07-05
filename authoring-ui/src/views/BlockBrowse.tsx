import { useCallback, useEffect, useState } from "react";
import { deprecate, getBlocks, getPalette } from "../api";
import type {
  AuthoredContract,
  BlockRow,
  PaletteCard,
  ParamCard,
  PortCard,
} from "../types";
import { RiskBadge, Spinner } from "../ui";

interface Props {
  // Hand a card off to the editor (load it as a draft to revise + republish).
  onEdit: (c: AuthoredContract) => void;
}

type Mode = "engineer" | "operator";

// Project a read-only PaletteCard back into an authored-contract draft so the editor can revise it.
// (The palette projection is lossy w.r.t. §5 wiring — idempotency/compensation/retry are NOT exposed
//  in the card — so we seed safe defaults the engineer then re-confirms before republishing.)
function cardToDraft(card: PaletteCard): AuthoredContract {
  const param = (p: ParamCard) => ({
    name: p.name,
    type: p.type,
    required: p.required,
    label: p.label,
    help: p.help,
    default: p.default,
    widget: p.widget,
    enumValues: p.enumValues,
  });
  const io = (p: PortCard) => ({ name: p.name, type: p.type, label: p.label });
  return {
    id: card.id,
    version: card.latestVersion,
    category: card.category as AuthoredContract["category"],
    displayName: card.displayName,
    description: card.description,
    params: card.params.map(param),
    inputs: card.inputs.map(io),
    outputs: card.outputs.map(io),
    forward: { handler: "" },
    idempotency: { strategy: "NONE", keyExpression: null },
    compensation: { reversibility: "REVERSIBLE", kind: "NONE", handler: null, requiresState: [] },
    stateBinding: [],
    retry: { maxAttempts: 1, backoff: { initialMs: 100, maxMs: 1000 } },
    timeoutMs: 30000,
    sideEffects: ["NONE"],
    human: { requireApprovalBefore: false },
  };
}

function Ports({ inputs, outputs }: { inputs: PortCard[]; outputs: PortCard[] }) {
  if (inputs.length === 0 && outputs.length === 0) return null;
  return (
    <div className="ports">
      <div>
        <span className="col-label">Inputs</span>
        {inputs.length === 0 ? (
          <span className="port muted">—</span>
        ) : (
          inputs.map((p) => (
            <span className="port" key={p.name}>
              <span className="arr-in">▸</span> {p.label || p.name}{" "}
              <span className="muted">:{p.type}</span>
            </span>
          ))
        )}
      </div>
      <div>
        <span className="col-label">Outputs</span>
        {outputs.length === 0 ? (
          <span className="port muted">—</span>
        ) : (
          outputs.map((p) => (
            <span className="port" key={p.name}>
              <span className="arr-out">◂</span> {p.label || p.name}{" "}
              <span className="muted">:{p.type}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export function BlockBrowse({ onEdit }: Props) {
  const [mode, setMode] = useState<Mode>("engineer");
  const [blocks, setBlocks] = useState<BlockRow[] | null>(null);
  const [palette, setPalette] = useState<PaletteCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; version: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [b, p] = await Promise.all([getBlocks(), getPalette()]);
      setBlocks(b);
      setPalette(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Escape closes the deprecate-confirm modal (unless a request is in flight).
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setConfirming(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, busy]);

  async function doDeprecate() {
    if (!confirming) return;
    setBusy(true);
    try {
      await deprecate(confirming.id, confirming.version);
      setConfirming(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="banner err">
        <span>API error: {error}</span>
        <button className="btn ghost push-right" onClick={() => void reload()}>
          retry
        </button>
      </div>
    );
  }

  if (!blocks || !palette) return <Spinner label="FETCHING REGISTRY" />;

  const showing =
    mode === "operator"
      ? palette.map<BlockRow>((card) => ({ card, deprecated: false, diagnostics: [] }))
      : blocks;

  return (
    <>
      <div className="toolbar">
        <div className="seg" role="tablist" aria-label="view mode">
          <button className={mode === "engineer" ? "on" : ""} onClick={() => setMode("engineer")}>
            Engineer · all blocks
          </button>
          <button className={mode === "operator" ? "on" : ""} onClick={() => setMode("operator")}>
            Operator · palette preview
          </button>
        </div>
        <span className="count">
          {mode === "operator"
            ? `${palette.length} canvas-ready in palette`
            : `${blocks.length} registered · ${blocks.filter((b) => b.card.complete && !b.deprecated).length} ready`}
        </span>
        <button className="btn ghost push-right" onClick={() => void reload()}>
          ↻ refresh
        </button>
      </div>

      {mode === "operator" && (
        <div className="banner info spaced">
          Operator view — the GET /palette projection. Only canvas-ready (complete), non-deprecated
          blocks show up here, one latest SemVer per id. (The real canvas UI lands in v0.4.)
        </div>
      )}

      {showing.length === 0 ? (
        <div className="empty">
          {mode === "operator"
            ? "Palette is empty — no canvas-ready blocks yet."
            : "No blocks registered."}
        </div>
      ) : (
        <div className="grid">
          {showing.map((row) => {
            const c = row.card;
            return (
              <article
                className={`card ${row.deprecated ? "is-deprecated" : ""}`}
                key={`${c.id}#${c.latestVersion}`}
              >
                <div className="card-head">
                  <div>
                    <div className="title">{c.displayName || c.id}</div>
                    <div className="id">
                      {c.id} <span className="ver">@{c.latestVersion}</span>
                    </div>
                  </div>
                  <RiskBadge risk={c.risk} />
                </div>

                <div className="desc">{c.description || <span className="muted">(no description)</span>}</div>

                <div className="meta">
                  <span className="chip cat">{c.category}</span>
                  {c.complete ? (
                    <span className="chip ready">● canvas-ready</span>
                  ) : (
                    <span className="chip incomplete">▲ incomplete</span>
                  )}
                  {row.deprecated && <span className="chip deprecated">✕ deprecated</span>}
                  {c.versions.length > 1 && (
                    <span className="chip">{c.versions.length} versions</span>
                  )}
                </div>

                <Ports inputs={c.inputs} outputs={c.outputs} />

                {row.diagnostics.length > 0 && (
                  <div className="diags">
                    {row.diagnostics.map((d, i) => (
                      <div className="diag" key={`${d.code}-${i}`}>
                        <span className="code">{d.code}</span>
                        <span className="msg">{d.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {mode === "engineer" && (
                  <div className="card-actions">
                    <button className="btn ghost" onClick={() => onEdit(cardToDraft(c))}>
                      Edit → republish
                    </button>
                    {!row.deprecated && (
                      <button
                        className="btn ghost danger push-right"
                        onClick={() => setConfirming({ id: c.id, version: c.latestVersion })}
                      >
                        Deprecate
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {confirming && (
        <div className="modal-scrim" onClick={() => !busy && setConfirming(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deprecate-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="deprecate-modal-title">Deprecate block (soft-delete)</h3>
            <div className="modal-body">
              <p>
                Deprecating{" "}
                <code>
                  {confirming.id}@{confirming.version}
                </code>{" "}
                hides it from the operator palette (GET /palette).
              </p>
              <p>
                This is a <strong>soft-delete</strong> — the resolve path stays intact, so workflows
                already pinned to this version (and their replays) keep working. We don't offer a
                hard delete: it isn't safe against immutability, replay, and external compensation.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" disabled={busy} onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button className="btn danger" disabled={busy} onClick={() => void doDeprecate()}>
                {busy ? "Working…" : "Confirm deprecation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

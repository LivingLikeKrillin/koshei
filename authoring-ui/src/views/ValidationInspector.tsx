import type { AuthoredContract, ValidationResponse } from "../types";
import { RiskBadge } from "../ui";

interface ValidationInspectorProps {
  contract: AuthoredContract;
  result: ValidationResponse | null;
  validating: boolean;
  netError: string | null;
  onProceedToPublish: () => void;
}

// Live verdict panel: ContractValidator errors + CanvasReadiness (C1–C5) + risk badge,
// the Publish-button gating, and a JSON peek of the authored contract.
export function ValidationInspector({
  contract,
  result,
  validating,
  netError,
  onProceedToPublish,
}: ValidationInspectorProps) {
  return (
    <aside className="inspector">
      <div className="panel">
        <div className="panel-head">
          <span>Live verdict</span>
          {validating && <span className="spin">▚ checking</span>}
        </div>
        <div className="panel-body">
          <div
            className={`verdict ${
              netError || !result ? "pending" : result.valid && result.complete ? "ok" : "bad"
            }`}
          >
            <span className="dot" />
            {netError
              ? "parse error"
              : !result
                ? "…"
                : result.valid && result.complete
                  ? "publishable"
                  : result.valid
                    ? "valid · incomplete"
                    : "invalid"}
          </div>

          {result && <RiskBadge risk={result.risk} />}

          {netError && (
            <div className="banner err inspector-error">
              {netError}
            </div>
          )}

          {result && result.errors.length > 0 && (
            <div>
              <div className="subhead">ContractValidator · runtime safety</div>
              {result.errors.map((e, i) => (
                <div className="err-line" key={i}>
                  {e}
                </div>
              ))}
            </div>
          )}

          {result && (
            <div>
              <div className="subhead">CanvasReadiness · C1–C5</div>
              {result.readiness.length === 0 ? (
                <div className="ok-note">✓ canvas-ready — all presentation metadata satisfied</div>
              ) : (
                <div className="diags flush">
                  {result.readiness.map((d, i) => (
                    <div className="diag" key={`${d.code}-${i}`}>
                      <span className="code">{d.code}</span>
                      <span className="msg">{d.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className="btn primary inspect-publish"
            disabled={!result || !result.valid}
            onClick={onProceedToPublish}
          >
            {result && !result.complete ? "Publish (incomplete — warning)" : "Publish →"}
          </button>
          {result && !result.complete && result.valid && (
            <span className="muted inspect-note">
              Valid but incomplete — you can publish, but it won't show up in the palette.
            </span>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span>Authored contract · JSON</span>
        </div>
        <div className="panel-body flush">
          <div className="json-peek">{JSON.stringify(contract, null, 2)}</div>
        </div>
      </div>
    </aside>
  );
}

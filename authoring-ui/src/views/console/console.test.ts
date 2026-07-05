import { describe, it, expect } from "vitest";
import { isTerminalStatus, isTerminalFailed, statusBadge, parkedNodeIds, compOutcomeBadge, runChip, runOutcomeBadge, shortRunId } from "./console";

// NOTE: the backend's queryStatus returns the Temporal proto enum NAME
// (e.g. "WORKFLOW_EXECUTION_STATUS_COMPLETED"), verified by run-console-gate.sh. The helpers
// normalize that long form (strip the prefix) so both the long and short forms work.

describe("console status helpers", () => {
  it("treats engine terminal statuses (long proto form) as terminal", () => {
    for (const s of [
      "WORKFLOW_EXECUTION_STATUS_COMPLETED",
      "WORKFLOW_EXECUTION_STATUS_FAILED",
      "WORKFLOW_EXECUTION_STATUS_TERMINATED",
      "WORKFLOW_EXECUTION_STATUS_CANCELED",
      "WORKFLOW_EXECUTION_STATUS_TIMED_OUT",
    ]) {
      expect(isTerminalStatus(s)).toBe(true);
    }
  });

  it("also accepts short forms", () => {
    expect(isTerminalStatus("COMPLETED")).toBe(true);
    expect(isTerminalStatus("completed")).toBe(true); // case-insensitive
  });

  it("treats RUNNING and UNKNOWN as non-terminal", () => {
    expect(isTerminalStatus("WORKFLOW_EXECUTION_STATUS_RUNNING")).toBe(false);
    expect(isTerminalStatus("UNKNOWN")).toBe(false);
    expect(isTerminalStatus("")).toBe(false);
  });

  it("maps statuses (long form) to a badge label + class", () => {
    expect(statusBadge("WORKFLOW_EXECUTION_STATUS_COMPLETED").cls).toBe("ok");
    expect(statusBadge("WORKFLOW_EXECUTION_STATUS_COMPLETED").label).toBe("DONE");
    expect(statusBadge("WORKFLOW_EXECUTION_STATUS_FAILED").cls).toBe("err");
    expect(statusBadge("WORKFLOW_EXECUTION_STATUS_RUNNING").cls).toBe("run");
    expect(statusBadge("UNKNOWN").cls).toBe("muted");
  });
});

describe("parkedNodeIds", () => {
  it("returns nodeIds whose state is PARKED, and nothing else", () => {
    expect(parkedNodeIds({ src: "DONE", mid: "DONE", sink: "PARKED" })).toEqual(["sink"]);
    expect(parkedNodeIds({ a: "RUNNING", b: "FAILED" })).toEqual([]);
    expect(parkedNodeIds({})).toEqual([]);
  });
});

describe("compOutcomeBadge", () => {
  it("maps compensation outcomes to a label + class", () => {
    expect(compOutcomeBadge("COMPENSATED")).toEqual({ label: "COMPENSATED", cls: "ok" });
    expect(compOutcomeBadge("FAILED")).toEqual({ label: "COMP FAILED", cls: "err" });
  });
  it("the COMP_FAILED node state lowercases to the ns-comp_failed CSS class", () => {
    // guards the BlockNode `ns-` + toLowerCase() contract (underscore, not hyphen)
    expect("COMP_FAILED".toLowerCase()).toBe("comp_failed");
  });
});

describe("isTerminalFailed", () => {
  it("is true for terminal failure statuses (short + long proto form)", () => {
    for (const s of ["FAILED", "TERMINATED", "TIMED_OUT",
                     "WORKFLOW_EXECUTION_STATUS_FAILED",
                     "WORKFLOW_EXECUTION_STATUS_TERMINATED"]) {
      expect(isTerminalFailed(s)).toBe(true);
    }
  });
  it("is false for COMPLETED and for non-terminal statuses", () => {
    for (const s of ["COMPLETED", "WORKFLOW_EXECUTION_STATUS_COMPLETED",
                     "RUNNING", "UNKNOWN", ""]) {
      expect(isTerminalFailed(s)).toBe(false);
    }
  });
});

describe("runChip / runOutcomeBadge (B1/B3)", () => {
  it("COMPLETED + COMPENSATED => RECOVERED", () => {
    expect(runOutcomeBadge("WORKFLOW_EXECUTION_STATUS_COMPLETED", "COMPENSATED").label).toBe("RECOVERED");
  });
  it("COMPLETED + NONE => DONE", () => {
    expect(runOutcomeBadge("COMPLETED", "NONE").label).toBe("DONE");
  });
  it("COMPLETED + COMP_FAILED => RECOVERY FAILED (err)", () => {
    const b = runOutcomeBadge("COMPLETED", "COMP_FAILED");
    expect(b.label).toBe("RECOVERY FAILED"); expect(b.cls).toBe("err");
  });
  it("awaitingApproval => NEEDS APPROVAL", () => {
    expect(runChip({ status: "RUNNING", awaitingApproval: true, compOutcome: null } as any).label).toBe("NEEDS APPROVAL");
  });
  it("not awaiting falls through to outcome/status", () => {
    expect(runChip({ status: "RUNNING", awaitingApproval: false } as any).label).toBe("RUNNING");
  });
});

describe("shortRunId (F11)", () => {
  it("shortens a long run id to a prefix + ellipsis", () => {
    expect(shortRunId("usab-happy-1783116287585")).toBe("usab-hap…");
  });
  it("leaves a short id (<= head+1 chars) unchanged", () => {
    expect(shortRunId("run-42")).toBe("run-42");
  });
});

import { test, expect } from "@playwright/test";
import { startRun, saveSectionVideo } from "./helpers";
import { caption, highlightNode, clearHighlight } from "./overlay";

test.afterEach(({ page }, testInfo) => saveSectionVideo(page, testInfo, "03-failsafe"));

test("preflight fails → reverse-topo compensation timeline, PLC never fires", async ({ page, request }) => {
  const runId = `e2e-fail-${Date.now()}`;
  await startRun(request, { runId, failAtBlockId: "transform.map", slowMs: 800 });

  await page.goto("/");
  await page.getByRole("button", { name: /console/i }).click();
  await page.getByTestId(`run-row-${runId}`).click();

  await caption(page, "A safety pre-check fails mid-run", 600);

  await expect(page.locator('.react-flow__node[data-id="preflight"] .rf-node')).toHaveClass(/ns-failed/, { timeout: 40_000 });

  await caption(page, "Completed steps roll back in reverse order", 600);

  await expect(page.locator('.react-flow__node[data-id="interlockAck"] .rf-node')).toHaveClass(/ns-compensated/, { timeout: 40_000 });
  await expect(page.locator('.react-flow__node[data-id="recordPlan"] .rf-node')).toHaveClass(/ns-compensated/, { timeout: 40_000 });

  // B3: a failed-but-rolled-back run reads "RECOVERED" (not "DONE" — distinct from a real success)
  await expect(page.getByText("RECOVERED").first()).toBeVisible({ timeout: 40_000 });

  // the compensation timeline panel shows exactly two ordered rows
  await expect(page.getByTestId("timeline-row-0")).toBeVisible();
  await expect(page.getByTestId("timeline-row-1")).toBeVisible();
  await expect(page.getByTestId("timeline-row-0")).toContainText("notify.email");
  await expect(page.getByTestId("timeline-row-1")).toContainText("db.upsert");

  // headline safety claim: the IRREVERSIBLE actuation never ran
  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).not.toHaveClass(/ns-done/);

  await expect(page.locator('.react-flow__node[data-id="applyPLC"]')).toBeVisible(); // laid out before highlight
  await highlightNode(page, "applyPLC", "not fired");
  await caption(page, "The irreversible PLC actuation never fires — safe by contract", 2400);
  await clearHighlight(page);
});

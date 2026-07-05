import { test, expect } from "@playwright/test";
import { startRun, saveSectionVideo } from "./helpers";
import { caption, installCursor } from "./overlay";

test.afterEach(({ page }, testInfo) => saveSectionVideo(page, testInfo, "02-run"));

test("run + per-node lighting + approve the actuation gate", async ({ page, request }) => {
  const runId = `e2e-happy-${Date.now()}`;
  await startRun(request, { runId, slowMs: 700 }); // slowMs widens the lighting window for the GIF

  await installCursor(page);
  await page.goto("/");
  await page.getByRole("button", { name: /console/i }).click();          // open Console tab
  await page.getByTestId(`run-row-${runId}`).click();                    // select the run

  await caption(page, "Run it — each node lights up as it completes", 600);

  // upstream nodes light to done; the actuate gate node shows AWAITING_APPROVAL (parked on the operator)
  await expect(page.locator('.react-flow__node[data-id="recordPlan"] .rf-node')).toHaveClass(/ns-done/, { timeout: 30_000 });
  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).toHaveClass(/ns-awaiting_approval/, { timeout: 30_000 });
  // B1: the run reads "NEEDS APPROVAL" (not "RUNNING") so the operator sees it is waiting on them
  await expect(page.getByText("NEEDS APPROVAL").first()).toBeVisible({ timeout: 30_000 });

  await caption(page, "Approve the irreversible actuation gate", 600);

  await page.getByTestId("approve-button").click();                      // operator approves

  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).toHaveClass(/ns-done/, { timeout: 30_000 });

  await caption(page, "Done — the recipe is applied", 600);
});

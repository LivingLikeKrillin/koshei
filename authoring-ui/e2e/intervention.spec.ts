import { test, expect } from "@playwright/test";
import { startRun, armForwardFault, disarmFault, saveSectionVideo } from "./helpers";
import { caption } from "./overlay";

test.afterEach(({ page }, testInfo) => saveSectionVideo(page, testInfo, "04-intervene"));

test("faulted preflight parks → operator retries → recovers → approves", async ({ page, request }) => {
  armForwardFault("transform.map");                       // table fault (so disarm→retry can recover)
  const runId = `e2e-intv-${Date.now()}`;
  await startRun(request, { runId, interactive: true });  // NO failAtBlockId — fault comes from the table

  await page.goto("/");
  await page.getByRole("button", { name: /console/i }).click();
  await page.getByTestId(`run-row-${runId}`).click();

  await expect(page.locator('.react-flow__node[data-id="preflight"] .rf-node')).toHaveClass(/ns-parked/, { timeout: 40_000 });

  await caption(page, "A failed step parks for the operator", 600);

  disarmFault("transform.map");                           // transient cause cleared

  await caption(page, "Operator fixes the cause and retries", 600);

  await page.getByTestId("retry-preflight").click();      // operator intervenes

  await expect(page.locator('.react-flow__node[data-id="preflight"] .rf-node')).toHaveClass(/ns-done/, { timeout: 40_000 });

  await caption(page, "Recovered → approved → done", 600);

  await page.getByTestId("approve-button").click();
  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).toHaveClass(/ns-done/, { timeout: 40_000 });
});

import { test, expect } from "@playwright/test";
import { startRun, armForwardFault, disarmFault } from "./helpers";
import { dragCardToCanvas } from "./overlay";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Operator-journey heuristic usability evaluation walkthrough (design 2026-07-04).
// Drives the REAL running app (Vite :5173 → :18090 real backend) as the non-dev operator "Park",
// capturing a screenshot at each operator-journey moment T1–T6 into docs/usability/assets/ for
// expert heuristic scoring. NOT a pass/fail test — the screenshots ARE the deliverable; assertions
// only stabilise timing so each shot captures the intended state. Reuses the known-good selectors
// from run-lighting / failure-timeline / intervention / authoring specs.

const ASSETS = resolve(process.cwd(), "..", "docs", "usability", "assets");
mkdirSync(ASSETS, { recursive: true });
const shot = (page: import("@playwright/test").Page, name: string) =>
  page.screenshot({ path: resolve(ASSETS, name), fullPage: false });

test.describe.configure({ mode: "serial" });

test("T1 compose — palette + drag blocks onto the canvas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /compose/i }).click();
  await expect(page.locator(".palette-card").first()).toBeVisible({ timeout: 15_000 });
  const canvas = page.locator('[data-testid="compose-canvas"]');
  await expect(canvas).toBeVisible({ timeout: 10_000 });
  // Capture the empty operator compose surface first (palette discoverability, wiring affordances).
  await shot(page, "T1a-compose-empty.png");

  const box = await canvas.boundingBox();
  if (!box) throw new Error("compose-canvas has no bounding box");
  const drops = [
    { blockId: "db.read", dx: 0.28, dy: 0.4 },
    { blockId: "db.upsert", dx: 0.55, dy: 0.4 },
    { blockId: "notify.email", dx: 0.8, dy: 0.4 },
  ];
  for (const { blockId, dx, dy } of drops) {
    const card = page.getByTestId(`palette-${blockId}`);
    const version =
      (await card.locator(".pc-id span").first().textContent().catch(() => null))?.replace(/^@/, "").trim() ||
      "1.0.0";
    await dragCardToCanvas(page, blockId, version, Math.round(box.x + box.width * dx), Math.round(box.y + box.height * dy));
    await page.waitForTimeout(300);
  }
  await expect(page.locator(".react-flow__node")).toHaveCount(3, { timeout: 8_000 });
  // Capture the composed canvas (3 nodes) — judge whether ports/wiring are self-evident to Park.
  await shot(page, "T1b-compose-blocks.png");
});

test("T2 compose — the save(=deploy) + run panel", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /compose/i }).click();
  await expect(page.locator('[data-testid="compose-canvas"]')).toBeVisible({ timeout: 10_000 });
  // The Compose Run/Save panel — judge whether "save = deploy = it will run on the line" is legible,
  // and whether the dev fault-injection inputs (failAt/slowMs/interactive) confuse the operator surface.
  await shot(page, "T2-compose-save-run-panel.png");
});

test("T3 run — live node lighting + parked at the irreversible actuation gate", async ({ page, request }) => {
  const runId = `usab-happy-${Date.now()}`;
  await startRun(request, { runId, slowMs: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: /console/i }).click();
  await page.getByTestId(`run-row-${runId}`).click();
  // Wait until upstream is done and the actuation gate is running (awaiting approval) = "parked".
  await expect(page.locator('.react-flow__node[data-id="recordPlan"] .rf-node')).toHaveClass(/ns-done/, { timeout: 30_000 });
  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).toHaveClass(/ns-awaiting_approval/, { timeout: 30_000 });
  // Judge: does Park see WHERE the run is + THAT it waits on them?
  await shot(page, "T3-parked-at-gate.png");
});

test("T4+T5 console — locate the run, read the DAG, approve the gate", async ({ page, request }) => {
  const runId = `usab-approve-${Date.now()}`;
  await startRun(request, { runId, slowMs: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: /console/i }).click();
  // T4: the run history list — judge whether Park can find + identify their run without jargon.
  await shot(page, "T4-console-runlist.png");
  await page.getByTestId(`run-row-${runId}`).click();
  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).toHaveClass(/ns-awaiting_approval/, { timeout: 30_000 });
  // T5: the approve/reject decision — judge legibility + consequence clarity (this actuates the line).
  await shot(page, "T5a-approve-reject-controls.png");
  await page.getByTestId("approve-button").click();
  await expect(page.locator('.react-flow__node[data-id="applyPLC"] .rf-node')).toHaveClass(/ns-done/, { timeout: 30_000 });
  await shot(page, "T5b-after-approve-done.png");
});

test("T6 console — a failure rolls back safely (compensation timeline)", async ({ page, request }) => {
  const runId = `usab-fail-${Date.now()}`;
  await startRun(request, { runId, failAtBlockId: "transform.map", slowMs: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /console/i }).click();
  await page.getByTestId(`run-row-${runId}`).click();
  await expect(page.locator('.react-flow__node[data-id="preflight"] .rf-node')).toHaveClass(/ns-failed/, { timeout: 40_000 });
  await expect(page.getByTestId("timeline-row-0")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByTestId("timeline-row-1")).toBeVisible();
  // Judge: does Park understand the line was left SAFE (the "immortal transaction" headline)?
  await shot(page, "T6-compensation-timeline.png");
});

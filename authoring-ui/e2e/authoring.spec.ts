import { test, expect } from "@playwright/test";
import { saveSectionVideo } from "./helpers";
import { caption, dragCardToCanvas } from "./overlay";

test.afterEach(({ page }, testInfo) => saveSectionVideo(page, testInfo, "01-compose"));

test("operator drags 3 blocks onto compose canvas", async ({ page }) => {
  await page.goto("/");

  // Default tab is "browse" — must click Compose tab first
  await page.getByRole("button", { name: /compose/i }).click();

  await caption(page, "Compose a workflow — drag blocks from the palette onto the canvas", 600);

  // Wait for the palette to populate (at least one card visible)
  await expect(page.locator(".palette-card").first()).toBeVisible({ timeout: 15_000 });

  // Wait for the ReactFlow canvas to be mounted and visible
  const canvas = page.locator('[data-testid="compose-canvas"]');
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  // Helper: read the pinned version from the palette card text (e.g. "@1.2.0" → "1.2.0").
  // Falls back to "1.0.0" if the card or its version span is absent.
  const getVersion = async (blockId: string): Promise<string> => {
    const card = page.getByTestId(`palette-${blockId}`);
    if (!(await card.isVisible())) return "1.0.0";
    const text = await card.locator(".pc-id span").first().textContent().catch(() => null);
    return text?.replace(/^@/, "").trim() || "1.0.0";
  };

  // Resolve the canvas bounding box for placing drops at viewport-absolute coordinates
  const box = await canvas.boundingBox();
  if (!box) throw new Error("compose-canvas has no bounding box — canvas is not rendered");

  // Three blocks, spread across the middle-third of the canvas height and across the width
  const drops = [
    { blockId: "db.read",      dx: 0.25, dy: 0.40 },
    { blockId: "db.upsert",    dx: 0.50, dy: 0.40 },
    { blockId: "notify.email", dx: 0.75, dy: 0.40 },
  ];

  for (const { blockId, dx, dy } of drops) {
    const version = await getVersion(blockId);
    const cx = Math.round(box.x + box.width  * dx);
    const cy = Math.round(box.y + box.height * dy);
    await dragCardToCanvas(page, blockId, version, cx, cy);
    // Let React flush the state update before the next drop
    await page.waitForTimeout(300);
  }

  // Core assertion: all 3 nodes appear in the React Flow graph
  await expect(page.locator(".react-flow__node")).toHaveCount(3, { timeout: 8_000 });

  // F04: with blocks on the canvas the validation panel must NOT read "Graph is empty"
  await expect(page.getByText("Graph is empty")).toHaveCount(0);

  // F05: the 3 dropped nodes do not stack — their left offsets differ (cascade-offset)
  const lefts = await page
    .locator(".react-flow__node")
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBeGreaterThan(1);

  // F08: the Save (deploy) button is in the viewport AND its panel is sticky (the actual fix)
  const saveBtn = page.getByTestId("save-button");
  await expect(saveBtn).toBeInViewport();
  const pos = await saveBtn.evaluate((el) => getComputedStyle(el.closest(".save-panel") as Element).position);
  expect(pos).toBe("sticky");
});

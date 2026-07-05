import { defineConfig } from "@playwright/test";

// E2E runs against the Vite dev server (proxies /api → :18090). The heavy stack
// (Docker + worker + authoring-api + deployed ot-recipe-apply) is brought up by
// scripts/run-e2e.sh BEFORE playwright runs. video:'on' records every test → GIF source.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,        // shared backend state (runs, fault_inject) → serialize
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 120_000,            // a run can take ~30-60s incl. the gate
  use: {
    baseURL: "http://localhost:5173",
    video: "on",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    // false: Playwright owns the Vite server. run-e2e.sh always brings up the stack, so reusing
    // whatever is already on :5173 risks silently testing a DIFFERENT app (and a false PASS).
    // With false, a stale :5173 occupant makes Playwright fail loudly instead.
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    // Runs first: loads "/" and waits for app text, forcing Vite to complete its first
    // compile before any recorded spec begins. video:'off' keeps the webm out of docs/demo/.
    { name: "warmup", testMatch: /warmup\.setup\.ts/, use: { video: "off" } },
    // All 4 demo specs + smoke run after warmup finishes. Inherits top-level `use`
    // (video:'on', viewport, baseURL) so GIF recording works unchanged.
    { name: "chromium", dependencies: ["warmup"] },
  ],
});

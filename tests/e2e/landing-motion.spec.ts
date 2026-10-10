import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const demo = (page: Page) => page.getByRole("group", { name: "Scripted review demo", exact: true });
async function start(page: Page) {
  const now = new Date("2026-10-09T12:00:00Z");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await page.goto("/");
  await expect(demo(page)).toHaveAttribute("data-playing", "true");
}

test("landing motion: complete scripted sequence, replay and no workspace storage", async ({ page }) => {
  await start(page);
  const preview = demo(page);
  await expect(preview.getByText("Waiting for source activity", { exact: true })).toBeVisible();
  const durations = [500, 850, 1100, 750, 750, 1000, 1000, 700];
  const labels = ["Source activity received", "Analyzing activity...", "Proposed changes ready for review", "Proposed changes ready for review", "Supporting evidence matched", "2 changes selected · Ready for review", "Applying selected changes…", "✓ 2 changes applied"];
  for (let index = 0; index < durations.length; index++) {
    await page.clock.runFor(durations[index]);
    await expect(preview).toHaveAttribute("data-step", String(index + 1));
    await expect(preview.getByText(labels[index], { exact: true })).toBeVisible();
    if (index === 2) await expect(preview.getByText("Stage", { exact: true })).toBeHidden();
    if (index === 3) await expect(preview.getByText("Stage", { exact: true })).toBeVisible();
  }
  await expect(preview.locator('.landing-check[data-checked="true"]')).toHaveCount(2);
  expect(await preview.locator('[aria-live], [role="status"]').count()).toBe(0);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  await page.clock.runFor(2600);
  await expect(preview).toHaveAttribute("data-step", "0");
});

test("landing motion: hover, focus and explicit pause preserve progress", async ({ page }) => {
  await start(page);
  await page.clock.runFor(200);
  await demo(page).hover();
  await expect(demo(page)).toHaveAttribute("data-playing", "false");
  await page.clock.runFor(5000);
  await expect(demo(page)).toHaveAttribute("data-step", "0");
  await page.mouse.move(0, 0);
  await expect(demo(page)).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(300);
  await expect(demo(page)).toHaveAttribute("data-step", "1");
  const pause = page.getByRole("button", { name: "Pause demo", exact: true });
  await pause.focus();
  await page.clock.runFor(4000);
  await expect(demo(page)).toHaveAttribute("data-step", "1");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Resume demo", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "View source", exact: true }).first().focus();
  await page.clock.runFor(4000);
  await expect(demo(page)).toHaveAttribute("data-step", "1");
  await page.getByRole("button", { name: "Resume demo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: "View source", exact: true }).first().focus();
  await expect(demo(page)).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(850);
  await expect(demo(page)).toHaveAttribute("data-step", "2");
});

test("landing motion: hidden document and offscreen preview stop the timeline", async ({ page }) => {
  await start(page);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(demo(page)).toHaveAttribute("data-playing", "false");
  await page.clock.runFor(5000);
  await expect(demo(page)).toHaveAttribute("data-step", "0");
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(demo(page)).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(500);
  await expect(demo(page)).toHaveAttribute("data-step", "1");
  await page.getByRole("heading", { name: "Explore DealPatch", exact: true }).scrollIntoViewIfNeeded();
  await expect(demo(page)).toHaveAttribute("data-playing", "false");
  await page.clock.runFor(5000);
  await expect(demo(page)).toHaveAttribute("data-step", "1");
  await demo(page).scrollIntoViewIfNeeded();
  await expect(demo(page)).toHaveAttribute("data-playing", "true");
});

test("landing motion: reduced motion is static and preference changes stop autoplay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(demo(page)).toHaveAttribute("data-step", "8");
  await expect(demo(page).getByText("✓ 2 changes applied", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause demo", exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Human-reviewed workflow" })).toHaveAttribute("data-progress", "6");
  await expect(page.locator('[data-reveal="waiting"]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(demo(page)).toHaveAttribute("data-playing", "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(demo(page)).toHaveAttribute("data-step", "8");
  await expect(demo(page)).toHaveAttribute("data-playing", "false");
});

test("landing motion: workflow progresses once and sections reveal once", async ({ page }) => {
  await start(page);
  const workflow = page.getByRole("list", { name: "Human-reviewed workflow" });
  await workflow.scrollIntoViewIfNeeded();
  await expect(page.locator('#how-it-works')).toHaveAttribute("data-reveal", "visible");
  await expect(workflow).toHaveAttribute("data-playing", "true");
  for (let step = 1; step <= 6; step++) {
    await page.clock.runFor(800);
    await expect(workflow).toHaveAttribute("data-progress", String(step));
  }
  await demo(page).scrollIntoViewIfNeeded();
  await workflow.scrollIntoViewIfNeeded();
  await expect(workflow).toHaveAttribute("data-progress", "6");
  await expect(page.locator('#how-it-works')).toHaveAttribute("data-reveal", "visible");
});

test("landing motion: product tabs support pointer, arrow keys, Home/End and axe", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Product views" });
  const pipeline = page.getByRole("tabpanel", { name: "Pipeline", exact: true });
  for (const name of ["Account", "Deal", "Stage", "Risk", "Value"]) await expect(pipeline.getByRole("columnheader", { name, exact: true })).toBeVisible();
  await tabs.getByRole("tab", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("tabpanel", { name: "Activity", exact: true })).toContainText("Local simulated analysis");
  await expect(page.getByRole("tabpanel", { name: "Activity", exact: true })).toContainText("Avelmere Systems");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "Review", exact: true })).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "Review", exact: true })).toContainText("20%");
  await expect(page.getByRole("tabpanel", { name: "Review", exact: true })).toContainText("Approve selected · Edit · Reject");
  await page.keyboard.press("End");
  await expect(page.getByRole("tabpanel", { name: "Audit", exact: true })).toContainText("Approval undone");
  await expect(page.getByRole("tabpanel", { name: "Audit", exact: true })).toContainText("1 Oct · 10:42 UTC");
  await page.keyboard.press("Home");
  await expect(tabs.getByRole("tab", { name: "Pipeline", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel", { name: "Pipeline", exact: true })).toBeFocused();
  for (const mode of ["morning", "afternoon", "evening", "night"]) {
    await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption(mode);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.emulateMedia({ forcedColors: "active" });
  await tabs.getByRole("tab", { name: "Pipeline", exact: true }).focus();
  expect(await tabs.getByRole("tab", { name: "Pipeline", exact: true }).evaluate(node => getComputedStyle(node).outlineStyle)).toBe("solid");
});

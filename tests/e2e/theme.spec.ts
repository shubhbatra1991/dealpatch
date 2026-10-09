import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { badge, openFirstReview, review, test, workspaceFixture } from "./workspace";

const modes = ["morning", "afternoon", "evening", "night"] as const;
const theme = (page: Page) => page.getByRole("combobox", { name: "Theme", exact: true });
async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  await test.info().attach(`axe-${name}`, { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
}

for (const mode of modes) test(`theme: ${mode} major surfaces and review states`, async ({ page }) => {
  test.setTimeout(120_000); // Full axe scans of routes and review states per palette.
  await theme(page).selectOption(mode);
  await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
  for (const [name, route] of [["overview", "/workspace"], ["pipeline", "/workspace/pipeline"], ["deal", "/workspace/deals/deal_001"], ["reviews", "/workspace/reviews"]]) {
    await page.goto(route);
    await expect(badge(page, 15)).toBeVisible();
    if (name === "overview") await expect(page.getByRole("meter", { name: "Workspace health score", exact: true })).toBeVisible();
    if (name === "pipeline") await expect(page.getByRole("table")).toBeVisible();
    if (name === "deal") await expect(page.getByRole("heading", { name: "Avelmere Systems — Commercial workflow rollout", exact: true })).toBeVisible();
    if (name === "reviews") await expect(review(page)).toBeVisible();
    await audit(page, name);
    await page.screenshot({ path: test.info().outputPath(`${mode}-${name}.png`) });
  }
  await openFirstReview(page);
  await page.keyboard.press("Enter");
  await review(page).getByRole("button", { name: /^Edit Probability on/ }).click();
  await page.getByRole("textbox", { name: "Edit proposed probability" }).fill("101");
  await page.getByRole("button", { name: "Save edit", exact: true }).click();
  await audit(page, "invalid-editor");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await workspaceFixture(page, "change-deal");
  await page.getByRole("button", { name: "Refresh current values", exact: true }).click();
  await expect(review(page)).toContainText("Stale · approval blocked");
  await audit(page, "stale-diff");
  await page.screenshot({ path: test.info().outputPath(`${mode}-conflict.png`) });
  await page.getByRole("button", { name: "Reject proposal", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await audit(page, "rejected");
  await workspaceFixture(page, "clear");
  await page.reload();
  await expect(badge(page, 15)).toBeVisible();
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await audit(page, "applied");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(badge(page, 15)).toBeVisible();
  await audit(page, "undone");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(theme(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await theme(page).focus();
  await expect(theme(page)).toBeFocused();
  await audit(page, "mobile");
  await page.screenshot({ path: test.info().outputPath(`${mode}-mobile.png`) });
});

test("theme: persistence, keyboard control and automatic local time boundaries", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.clock.install({ time: new Date(2026, 9, 9, 11, 59, 30) });
  await page.reload();
  await expect(theme(page)).toHaveValue("auto");
  await expect(theme(page).getByRole("option", { name: "Automatic · Morning", exact: true })).toBeAttached();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "morning");
  await page.clock.fastForward(30_001);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "afternoon");
  await theme(page).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(theme(page)).toHaveValue("night");
  await expect(theme(page)).toBeFocused();
  await page.reload();
  await expect(theme(page)).toHaveValue("night");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await theme(page).selectOption("auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "afternoon");
  expect(await page.evaluate(() => localStorage.getItem("dealpatch.theme"))).toBe("auto");
  await page.clock.setSystemTime(new Date(2026, 9, 9, 21));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.reload();
  await expect(theme(page)).toHaveValue("auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  expect(errors).toEqual([]);
});

test("theme: pre-paint theme works without hydration and invalid preference falls back", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: true });
  const page = await context.newPage();
  try {
    await context.addInitScript(() => { if (!localStorage.getItem("dealpatch.theme")) localStorage.setItem("dealpatch.theme", "evening"); });
    await page.route("**/_next/**/*.js*", route => route.abort());
    await page.goto("http://localhost:3100/workspace", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "evening");
    expect(await page.locator("body").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(37, 33, 39)");
    await page.unrouteAll();
    await page.evaluate(() => localStorage.setItem("dealpatch.theme", "unexpected"));
    await page.reload();
    await expect(theme(page)).toHaveValue("auto");
  } finally { await context.close(); }
});

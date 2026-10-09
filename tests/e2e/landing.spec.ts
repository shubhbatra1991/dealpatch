import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { projectLinks } from "../../lib/project";

const theme = (page: import("@playwright/test").Page) => page.getByRole("combobox", { name: "Theme", exact: true });

for (const mode of ["morning", "afternoon", "evening", "night"]) test(`landing: ${mode} desktop/mobile visuals and accessibility`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00Z"));
  await page.goto("/");
  await theme(page).selectOption(mode);
  await expect(page.locator("html")).toHaveAttribute("data-theme", mode);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Human-reviewed automation for modern sales workflows.");
  for (const [label, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`${mode}-${label}.png`, { animations: "disabled", fullPage: true });
    const results = await new AxeBuilder({ page }).analyze();
    await test.info().attach(`axe-${mode}-${label}`, { body: JSON.stringify(results), contentType: "application/json" });
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
  }
});

test("landing: metadata, project links and lightweight workspace entry", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("DealPatch — Human-Reviewed Sales Automation");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "DealPatch — Human-Reviewed Sales Automation");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /open-source, local-first/);
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  await expect(page.getByRole("link", { name: "View source", exact: true })).toHaveAttribute("href", projectLinks.source);
  const footer = page.getByRole("navigation", { name: "Project links" });
  for (const [name, href] of [["GitHub", projectLinks.source], ["Documentation", projectLinks.documentation], ["Security", projectLinks.security], ["MIT License", projectLinks.license]]) await expect(footer.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  await expect(page.getByRole("link", { name: "Explore workspace", exact: true }).first()).toHaveAttribute("href", "/workspace");
  await theme(page).selectOption("night");
  await page.getByRole("main").getByRole("link", { name: "Explore workspace", exact: true }).first().click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("meter", { name: "Workspace health score", exact: true })).toBeVisible();
  await expect(theme(page)).toHaveValue("night");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Pipeline", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/pipeline$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Human-reviewed automation");
  await expect(theme(page)).toHaveValue("night");
  expect(errors).toEqual([]);
});

test("landing: automatic theme, keyboard, reflow and reduced motion", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 9, 11, 59, 30) });
  await page.goto("/");
  await expect(theme(page)).toHaveValue("auto");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "morning");
  await page.clock.fastForward(30_001);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "afternoon");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await theme(page).focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(theme(page)).toHaveValue("night");
  await expect(theme(page)).toBeFocused();
  await page.reload();
  await expect(theme(page)).toHaveValue("night");
  for (const width of [1920, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(theme(page)).toBeInViewport();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.getByRole("link", { name: "View source", exact: true }).evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(0.001);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Axe's authored-color contrast calculation does not model forced system paints.
  // Check forced-color focus separately, as in the workspace accessibility suite.
  await page.emulateMedia({ forcedColors: "active" });
  await theme(page).focus();
  expect(await theme(page).evaluate(node => getComputedStyle(node).outlineStyle)).toBe("solid");
});

test("workspace routes: favorites, saved views and search keep their destinations", async ({ page }) => {
  await page.goto("/workspace/accounts/account_001");
  await page.getByRole("button", { name: "Add Avelmere Systems to favorites", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link", { name: /Account: Avelmere Systems/ })).toHaveAttribute("href", "/workspace/accounts/account_001");
  await navigation.getByRole("link", { name: "Pipeline", exact: true }).click();
  await page.getByRole("combobox", { name: "Risk", exact: true }).selectOption("High");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  await page.getByRole("textbox", { name: "View name", exact: true }).fill("Risk review");
  await page.getByRole("dialog", { name: "Save Pipeline view", exact: true }).getByRole("button", { name: "Save view", exact: true }).click();
  await navigation.getByRole("link", { name: "Risk review", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/pipeline\?view=/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Risk", exact: true })).toHaveValue("High");
  await navigation.getByRole("link", { name: /Account: Avelmere Systems/ }).click();
  await expect(page).toHaveURL(/\/workspace\/accounts\/account_001$/);
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  await page.getByRole("combobox", { name: /^Search accounts/ }).fill("Avelmere");
  await page.getByRole("option").filter({ hasText: "Commercial workflow rollout" }).first().click();
  await expect(page).toHaveURL(/\/workspace\/deals\/deal_001$/);
});

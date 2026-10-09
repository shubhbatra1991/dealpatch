import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { badge, test } from "./workspace";

async function ready(page: Page, route: string) {
  await page.goto(route);
  await expect(badge(page, 15)).toBeVisible();
  if (route === "/") await expect(page.getByRole("meter", { name: "Workspace health score", exact: true })).toBeVisible();
  else if (route === "/pipeline") await expect(page.getByRole("table")).toBeVisible();
  else if (route === "/reviews") await expect(page.getByRole("article")).toBeVisible();
  else if (route === "/activity") await expect(page.getByRole("list", { name: "Activity feed" }).getByRole("button")).toHaveCount(150);
  else await expect(page.getByRole("main").getByRole("button", { name: /^Add .+ to favorites$/ })).toBeVisible();
}

// Fixed clock + freshly seeded native IndexedDB; no streamed/running states or random IDs.
for (const mode of ["morning", "night"]) test(`visual: ${mode} workspace surfaces`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00Z"));
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption(mode);
  for (const [name, route] of [["overview", "/"], ["pipeline", "/pipeline"], ["account", "/accounts/account_001"], ["contact", "/contacts/contact_001"], ["deal", "/deals/deal_001"], ["reviews", "/reviews"], ["activity", "/activity"]]) {
    await ready(page, route);
    await expect(page).toHaveScreenshot(`${mode}-${name}.png`, { animations: "disabled" });
  }
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  await page.getByRole("combobox", { name: /^Search accounts/ }).fill("Avelmere");
  await expect(page.getByRole("option")).not.toHaveCount(0);
  await expect(page).toHaveScreenshot(`${mode}-search.png`, { animations: "disabled" });
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("visual: responsive shell and intentional table scrolling", async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00Z"));
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("night");
  for (const [width, height] of [[1920, 1080], [1280, 800], [768, 1024], [390, 844], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await ready(page, "/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Search workspace", exact: true })).toBeInViewport();
    await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toBeInViewport();
    await expect(page).toHaveScreenshot(`night-overview-${width}.png`, { animations: "disabled" });
    await ready(page, "/pipeline");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const tableRegion = page.getByRole("region", { name: "Pipeline deals, scroll horizontally for more columns", exact: true });
    if (width < 1920) expect(await tableRegion.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    await expect(page).toHaveScreenshot(`night-pipeline-${width}.png`, { animations: "disabled" });
    if (width <= 390) {
      await page.getByRole("button", { name: "Search workspace", exact: true }).click();
      await expect(page.getByRole("dialog")).toBeInViewport();
      await expect(page.getByRole("combobox", { name: /^Search accounts/ })).toBeFocused();
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations).toEqual([]);
      await page.keyboard.press("Escape");
    }
  }
});

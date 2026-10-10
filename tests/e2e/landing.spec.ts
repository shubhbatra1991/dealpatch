import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { projectLinks } from "../../lib/project";

const theme = (page: import("@playwright/test").Page) => page.getByRole("combobox", { name: "Theme", exact: true });

test("landing: native scrollbar can be dragged", async ({ playwright }) => {
  // Playwright normally hides browser scrollbars in headless mode.
  const browser = await playwright.chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:3100/");
    const gutter = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
    expect(gutter).toBeGreaterThan(0);
    await page.mouse.move(1440 - gutter / 2, 50);
    await page.mouse.down();
    await page.mouse.move(1440 - gutter / 2, 700, { steps: 15 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(900);
  } finally { await browser.close(); }
});

test("landing: PageDown and Space scroll without trapping keyboard input", async ({ page }) => {
  await page.goto("/");
  for (const key of ["PageDown", "Space"]) {
    await page.keyboard.press("Home");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const finished = page.evaluate(() => new Promise<void>(resolve => document.addEventListener("scrollend", () => resolve(), { once: true })));
    await page.keyboard.press(key);
    await finished;
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  }
});

test("landing: native touch gesture scrolls the mobile document", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto("http://localhost:3100/");
    const session = await context.newCDPSession(page);
    // Dispatch a swipe through the browser input pipeline, not scrollTo or a
    // synthetic DOM event. Frame spacing lets Chromium recognize touch panning.
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 650 }] });
    for (let y = 630; y >= 150; y -= 20) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y }] });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});

test("landing: mouse wheel and keyboard can scroll the document", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.mouse.move(width / 2, 400);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    // A visible footer can precede completion of the browser's native End scroll.
    // Wait for scrollend before reversing direction with Home.
    const endScroll = page.evaluate(() => new Promise<void>(resolve => {
      document.addEventListener("scrollend", () => resolve(), { once: true });
    }));
    await page.keyboard.press("End");
    await endScroll;
    await expect(page.getByRole("contentinfo")).toBeInViewport();
    await page.keyboard.press("Home");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test("landing: all lower sections and footer are reachable and keyboard accessible", async ({ page }) => {
  await page.goto("/");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const id of ["how-it-works", "product", "human-review", "local-first", "engineering", "open-source"]) {
      const section = page.locator(`#${id}`);
      await section.getByRole("heading", { level: 2 }).scrollIntoViewIfNeeded();
      await expect(section).toHaveAttribute("data-reveal", "visible");
      await expect(section.getByRole("heading", { level: 2 })).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const review = page.locator("#human-review");
  for (const principle of ["Visibility.", "Evidence.", "Control.", "Traceability.", "Undoability."]) await expect(review.getByText(principle, { exact: true })).toBeVisible();
  await expect(review.getByRole("blockquote")).toContainText("The sponsor confirmed");
  for (const title of ["Accessibility-first", "Keyboard navigation", "Virtualized large datasets", "Optimistic updates", "Stale-change protection", "Automated tests", "Cross-browser validation", "Local persistence", "Automated accessibility testing", "Performance profiling"]) await expect(page.locator("#engineering").getByRole("heading", { name: title, exact: true })).toBeVisible();
  const source = page.locator("#open-source");
  await source.getByRole("link", { name: "Explore workspace", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(source.getByRole("link", { name: "View source", exact: true })).toBeFocused();
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText("Open-source educational B2B sales workspace.");
  await expect(footer.getByRole("list", { name: "Built with" })).toHaveText("Next.jsReactTypeScript");
  await expect(footer.locator(".landing-footer-bottom")).toContainText(String(new Date().getFullYear()));
  const product = footer.getByRole("navigation", { name: "Footer product links" });
  for (const [name, href] of [["Explore workspace", "/workspace"], ["How it works", "#how-it-works"], ["Product showcase", "#product"]]) await expect(product.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  const links = footer.getByRole("navigation", { name: "Project links" });
  await footer.getByRole("navigation", { name: "Footer product links" }).getByRole("link", { name: "Product showcase", exact: true }).focus();
  for (const name of ["GitHub", "Documentation", "Security", "MIT License"]) {
    await page.keyboard.press("Tab");
    const link = links.getByRole("link", { name, exact: true });
    await expect(link).toBeFocused();
    expect(await link.evaluate(node => getComputedStyle(node).outlineStyle)).toBe("solid");
  }
});

for (const mode of ["morning", "afternoon", "evening", "night"]) test(`landing: ${mode} desktop/mobile visuals and accessibility`, async ({ page }) => {
  test.setTimeout(120_000);
  // Stable completed demo and all sections visible; motion is tested separately.
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await expect(page.getByRole("link", { name: "View source", exact: true }).first()).toHaveAttribute("href", projectLinks.source);
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
  expect(await page.getByRole("link", { name: "View source", exact: true }).first().evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThan(0.001);
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

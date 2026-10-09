import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { badge, notifications, openFirstReview, review, test, workspaceFixture } from "./workspace";

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  await test.info().attach("axe-results", { body: JSON.stringify(results, null, 2), contentType: "application/json" });
  expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
  expect(await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(element => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  })).toEqual([]);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[aria-hidden="true"] button, [aria-hidden="true"] a[href], [aria-hidden="true"] input, [aria-hidden="true"] [tabindex]')].filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length && !element.closest("[inert]")).map(element => element.outerHTML))).toEqual([]);
}

const routes = ["/", "/pipeline", "/accounts", "/accounts/account_001", "/contacts", "/contacts/contact_001", "/deals/deal_001", "/activity", "/reviews"];
for (const route of routes) test(`accessibility: route ${route}`, async ({ page }) => {
  await page.goto(route);
  await expect(badge(page, 15)).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Loading .*data|Loading .*workspace|Loading local/)).toHaveCount(0);
  if (["/pipeline", "/accounts", "/contacts"].includes(route)) await expect(page.getByRole("main").getByRole("table")).toBeVisible();
  else if (route === "/") await expect(page.getByRole("meter", { name: "Workspace health score", exact: true })).toBeVisible();
  else if (route === "/activity") await expect(page.getByRole("list", { name: "Activity feed" }).getByRole("button")).toHaveCount(150);
  else if (route === "/reviews") await expect(review(page)).toBeVisible();
  else await expect(page.getByRole("main").getByRole("button", { name: /^Add .+ to favorites$/ })).toBeVisible();
  await audit(page);
  if (route === "/accounts/account_001" || route === "/deals/deal_001") {
    for (const name of ["Contacts", route.startsWith("/accounts") ? "Opportunities" : "Reviews", "Activity", "Changes"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      await audit(page);
    }
  }
});

test("accessibility: command palette and review editor", async ({ page }) => {
  const opener = page.getByRole("button", { name: /^Search workspace/ });
  await opener.click();
  await expect(page.getByRole("combobox", { name: /^Search accounts/ })).toBeFocused();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await openFirstReview(page);
  await review(page).getByRole("button", { name: /^Edit Probability on/ }).click();
  await page.getByRole("textbox", { name: "Edit proposed probability" }).fill("101");
  await page.getByRole("button", { name: "Save edit", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Edit proposed probability" })).toHaveAttribute("aria-invalid", "true");
  await audit(page);
});

test("accessibility: stale review", async ({ page }) => {
  await openFirstReview(page);
  await workspaceFixture(page, "change-deal");
  await page.getByRole("button", { name: "Refresh current values", exact: true }).click();
  await expect(review(page)).toContainText("Stale · approval blocked");
  await expect(review(page).getByRole("status")).toContainText("Conflict detected");
  await audit(page);
});

test("accessibility: rollback error and reviewed history", async ({ page }) => {
  await openFirstReview(page);
  await workspaceFixture(page, "change-deal");
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(notifications(page).getByRole("alert")).toContainText("Approval failed. Previous values and the proposal were restored.");
  await audit(page);
  await review(page).getByRole("button", { name: "Reject proposal", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Rejected remaining changes" })).toHaveCount(1);
  await page.getByRole("combobox", { name: "Proposal status", exact: true }).selectOption("Rejected");
  await expect(page.getByRole("list", { name: "Review proposals" }).getByRole("button")).toHaveCount(1);
  await audit(page);
});

test("accessibility: skip link, shell navigation and shortcut help", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content", exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await skip.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const pipeline = page.getByRole("navigation", { name: "Main navigation", exact: true }).getByRole("link", { name: "Pipeline", exact: true });
  await pipeline.focus();
  await pipeline.press("Enter");
  await expect(pipeline).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("main")).toBeFocused();
  const help = page.getByRole("button", { name: "Keyboard shortcuts", exact: true });
  await help.focus();
  await help.press("Enter");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Close/ })).toBeFocused();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
});

test("accessibility: palette keyboard, modal containment and focus restoration", async ({ page }) => {
  const opener = page.getByRole("button", { name: /^Search workspace/ });
  await opener.focus();
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: /^Search accounts/ });
  await expect(search).toBeFocused();
  await search.fill("Avelmere");
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await search.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await search.press("ArrowUp");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await page.screenshot({ path: test.info().outputPath("palette-focus.png") });
  await search.press("Tab");
  await expect(page.getByRole("dialog").getByRole("button", { name: /Close/ })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(search).toBeFocused();
  await search.press("Escape");
  await expect(opener).toBeFocused();
  await page.keyboard.press("Meta+k");
  await expect(search).toBeFocused();
  await page.keyboard.press("Control+k");
  await expect(opener).toBeFocused();
  await opener.press("Enter");
  await search.fill("Avelmere Systems");
  await search.press("Enter");
  await expect(page).toHaveURL(/accounts\/account_001$/);
  await expect(page.getByRole("main")).toBeFocused();
});

test("accessibility: review diff, editor focus and approval announcements", async ({ page }) => {
  await openFirstReview(page);
  const selected = page.getByRole("list", { name: "Review proposals" }).getByRole("button", { name: "Avelmere Systems · Pending · 2 changes", exact: true });
  await selected.focus();
  await selected.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  const edit = review(page).getByRole("button", { name: /^Edit Probability on/ });
  await edit.click();
  const value = page.getByRole("textbox", { name: "Edit proposed probability" });
  await expect(value).toBeFocused();
  await value.fill("101");
  await page.getByRole("button", { name: "Save edit", exact: true }).click();
  await expect(value).toBeFocused();
  await expect(value).toHaveAttribute("aria-invalid", "true");
  const errorId = await value.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  await expect(page.locator(`[id="${errorId}"]`)).toHaveAttribute("role", "alert");
  await value.press("Escape");
  await expect(edit).toBeFocused();
  const diff = review(page).getByRole("group", { name: /^Probability on/ });
  await expect(diff).toContainText("Current value20%");
  await expect(diff).toContainText("Proposed value45%");
  await page.keyboard.press("Escape");
  await expect(selected).toBeFocused();
  const approve = review(page).getByRole("button", { name: "Approve all (2)", exact: true });
  await approve.focus();
  await approve.press("Enter");
  await expect(notifications(page).getByRole("status")).toContainText("Approved 2 changes");
  await expect(notifications(page).getByRole("button", { name: "Undo", exact: true })).not.toBeFocused();
  await notifications(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(notifications(page).getByRole("status")).toContainText("Approval undone");
  await expect(badge(page, 15)).toBeVisible();
});

test("accessibility: Pipeline Tab order, selection, sorting and column controls", async ({ page }) => {
  await page.goto("/pipeline");
  const region = page.getByRole("region", { name: /^Pipeline deals/ });
  await region.focus();
  await region.press("ArrowDown");
  const firstSelection = page.getByRole("checkbox", { name: /^Select / }).nth(1);
  await expect(firstSelection).toBeFocused();
  await page.keyboard.press("Space");
  await expect(firstSelection).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(region.getByRole("link").first()).toBeFocused();
  const header = page.getByRole("columnheader", { name: "Value", exact: true });
  await header.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  const columns = page.locator("summary").filter({ hasText: /^Columns/ });
  await columns.focus();
  await columns.press("Enter");
  await page.getByRole("checkbox", { name: "Next Step", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("columnheader", { name: "Next Step", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(columns).toBeFocused();
  await region.focus();
  await region.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/deals\//);
});

test("accessibility: relationship table keyboard paths and contextual favorites", async ({ page }) => {
  for (const [path, label] of [["/accounts", "Accounts"], ["/contacts", "Contacts"]]) {
    await page.goto(path);
    const region = page.getByRole("region", { name: new RegExp(`^${label} table`) });
    await region.focus();
    await region.press("ArrowDown");
    await expect(region.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(region.getByRole("link").nth(label === "Contacts" ? 2 : 1)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path}/`));
    await expect(page.getByRole("button", { name: /^Add .+ to favorites$/ })).toBeVisible();
    const name = await page.getByRole("heading", { level: 1 }).innerText();
    const star = page.getByRole("button", { name: `Add ${name} to favorites`, exact: true });
    await star.focus();
    await star.press("Enter");
    await expect(page.getByRole("button", { name: `Remove ${name} from favorites`, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("list", { name: "Favorite records" })).toContainText(name);
  }
});

test("accessibility: shortcuts pause in editable controls", async ({ page }) => {
  await page.goto("/activity");
  const search = page.getByRole("searchbox", { name: "Search activities" });
  await search.pressSequentially("jkr");
  await search.press("Control+k");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(search).toHaveValue("jkr");
  await page.getByRole("combobox", { name: "Activity type", exact: true }).focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // A temporary editable fixture exercises the global handler without adding product UI.
  await page.evaluate(() => { const editable = document.createElement("div"); editable.contentEditable = "true"; editable.setAttribute("aria-label", "Editable test fixture"); document.querySelector("main")!.append(editable); editable.focus(); });
  await page.keyboard.type("jkar");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Editable test fixture").evaluate(element => element.remove());
  await page.goto("/reviews");
  await openFirstReview(page);
  await review(page).getByRole("button", { name: /^Edit Probability on/ }).click();
  const input = page.getByRole("textbox", { name: "Edit proposed probability" });
  await input.fill("");
  await input.pressSequentially("jkar");
  await expect(badge(page, 15)).toBeVisible();
  await expect(input).toHaveValue("jkar");
});

test("accessibility: saved-view modal keyboard and focus", async ({ page }) => {
  await page.goto("/pipeline");
  const save = page.getByRole("button", { name: "Save view", exact: true });
  await save.focus();
  await save.press("Enter");
  const name = page.getByRole("textbox", { name: "View name" });
  await expect(name).toBeFocused();
  await name.fill("   ");
  await name.press("Enter");
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  await name.fill("Keyboard test view");
  await name.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(save).toBeFocused();
  await page.getByLabel("Manage Keyboard test view").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Rename Keyboard test view", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Rename saved view" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Manage Keyboard test view")).toBeFocused();
  await audit(page);
});

test("accessibility: activity navigation and simulated status announcements", async ({ page }) => {
  await workspaceFixture(page, "remove-source-proposal");
  await page.goto("/activity?activity=activity_003");
  const feed = page.getByRole("list", { name: "Activity feed" });
  const selected = feed.getByRole("button").and(page.locator('[aria-current="true"]'));
  await selected.focus();
  await selected.press("ArrowDown");
  await expect(feed.getByRole("button").and(page.locator('[aria-current="true"]'))).toBeFocused();
  await page.keyboard.press("k");
  await page.keyboard.press("Enter");
  await expect(page.locator("#activity-detail")).toBeFocused();
  await page.getByRole("button", { name: "Run simulated analysis", exact: true }).focus();
  await page.keyboard.press("Enter");
  const analysis = page.getByRole("region", { name: "Demo intelligence" });
  await expect(analysis.getByRole("status").filter({ hasText: "Simulated analysis started." })).toHaveCount(1);
  await expect(analysis.getByRole("status").filter({ hasText: "Simulated analysis completed." })).toHaveCount(1);
  await page.getByRole("button", { name: "Send to Review Queue", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(analysis.getByRole("status").filter({ hasText: "Proposal saved for human review." })).toBeVisible();
  await expect(badge(page, 15)).toBeVisible();
});

test("accessibility: reduced motion and forced colors", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/pipeline");
  const search = page.getByRole("button", { name: /^Search workspace/ });
  await search.focus();
  expect(await search.evaluate(element => { const style = getComputedStyle(element); return parseFloat(style.outlineWidth); })).toBeGreaterThanOrEqual(2);
  expect(await search.evaluate(element => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.00001);
  await search.press("Enter");
  await expect(page.getByRole("combobox", { name: /^Search accounts/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
});

test("accessibility: narrow layouts, zoom-equivalent reflow and enlarged text", async ({ page }) => {
  test.setTimeout(90_000);
  for (const width of [390, 720, 768]) {
    // 720 × 500 CSS pixels is the reflow area of 1440 × 1000 at 200% zoom.
    await page.setViewportSize({ width, height: width === 720 ? 500 : 844 });
    for (const route of ["/pipeline", "/activity", "/reviews", "/deals/deal_001"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const main = page.getByRole("main");
      expect(await main.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
      if (width === 390 && (route === "/activity" || route === "/reviews")) await page.screenshot({ path: test.info().outputPath(`mobile-${route.slice(1)}.png`), fullPage: true });
      if (width === 390 && route === "/activity") {
        await page.getByRole("button", { name: "Run simulated analysis", exact: true }).focus();
        await expect(page.getByRole("button", { name: "Run simulated analysis", exact: true })).toBeInViewport();
        await page.screenshot({ path: test.info().outputPath("mobile-activity-detail.png") });
      }
      if (width === 390 && route === "/reviews") {
        await page.getByRole("list", { name: "Review proposals" }).getByRole("button").first().focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog").getByRole("button", { name: /Close/ })).toBeInViewport();
        await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).focus();
        await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeInViewport();
        await page.screenshot({ path: test.info().outputPath("mobile-review-dialog.png") });
        await page.keyboard.press("Escape");
      }
    }
    await page.getByRole("button", { name: /^Search workspace/ }).click();
    await expect(page.getByRole("combobox", { name: /^Search accounts/ })).toBeInViewport();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Close/ })).toBeInViewport();
    await audit(page);
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/reviews");
  // Enlarge rem-based text separately; native browser UI zoom is a manual limitation.
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await openFirstReview(page);
  await page.getByRole("list", { name: "Review proposals" }).getByRole("button", { name: "Avelmere Systems · Pending · 2 changes", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("button", { name: /Close/ })).toBeInViewport();
  await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("zoom-review.png"), fullPage: true });
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).focus();
  await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeInViewport();
  await expect(page.getByRole("dialog").getByRole("button", { name: /Close/ })).toBeInViewport();
});

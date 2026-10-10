import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { badge, expectDeal, notifications, openFirstReview, review, test } from "./workspace";

const historyList = (page: import("@playwright/test").Page) => page.getByRole("list", { name: "Review history", exact: true });
async function openHistory(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "Review History", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review History", exact: true })).toBeVisible();
}

test("history: rejected proposal persists, stays out of queue and read-only detail preserves unchanged CRM", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Reject proposal", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await expect(page.getByRole("list", { name: "Review proposals", exact: true }).getByRole("button", { name: "Avelmere Systems · Pending · 2 changes", exact: true })).toHaveCount(0);
  await openHistory(page);
  await expect(page.getByRole("link", { name: "Review History", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(badge(page, 14)).not.toHaveAttribute("aria-current", "page");
  await page.getByRole("combobox", { name: "History status", exact: true }).selectOption("Rejected");
  const summary = historyList(page).locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  const article = page.getByRole("article", { name: "Review history · Avelmere Systems", exact: true });
  await expect(article).toContainText("CRM data was not changed.");
  await expect(article.getByRole("button")).toHaveCount(0);
  await expect(article.getByRole("checkbox")).toHaveCount(0);
  await expect(article).toContainText("Supporting evidence");
  await expect(article).toContainText("Proposal Rejected");
  await article.getByRole("link", { name: "Link to this review", exact: true }).click();
  await expect(page).toHaveURL(/\/reviews\/history\?proposal=proposal_001$/);
  await page.reload();
  await expect(article).toContainText("CRM data was not changed.");
  await expect(badge(page, 14)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await article.getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.getByRole("tab", { name: "Reviews", exact: true }).click();
  await expect(page.getByRole("region", { name: "Review history", exact: true })).toContainText("Rejected");
});

test("history: approval then Undo preserves both actions and reverted fields after refresh", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await notifications(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(notifications(page)).toContainText("Approval undone");
  await expect(badge(page, 15)).toBeVisible();
  await openHistory(page);
  await page.getByRole("combobox", { name: "History status", exact: true }).selectOption("Undone / Reverted");
  await historyList(page).locator("summary").first().click();
  const article = page.getByRole("article", { name: "Review history · Avelmere Systems", exact: true });
  await expect(article).toContainText("Reverted");
  const audit = article.getByRole("region", { name: "Review audit trail", exact: true });
  await expect(audit.getByText(/Proposal Approved/)).toHaveCount(2);
  await expect(audit.getByText(/Approval Undone/)).toHaveCount(2);
  await article.getByRole("link", { name: "Link to this review", exact: true }).click();
  await expect(page).toHaveURL(/\/reviews\/history\?proposal=proposal_001$/);
  await page.reload();
  await expect(article).toContainText("Undone / Reverted");
  await article.getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.getByRole("tab", { name: "Reviews", exact: true }).click();
  await expect(page.getByRole("region", { name: "Review history", exact: true })).toContainText("Undone / Reverted");
});

test("history: edited partial outcomes, search, account and status filters", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: /^Edit Probability on/ }).click();
  await page.getByRole("textbox", { name: "Edit proposed probability" }).fill("55");
  await page.getByRole("button", { name: "Save edit", exact: true }).click();
  await review(page).getByRole("checkbox", { name: /^Select Stage on/ }).uncheck();
  await review(page).getByRole("button", { name: "Approve selected (1)", exact: true }).click();
  await expect(badge(page, 15)).toBeVisible();
  await openHistory(page);
  await page.getByRole("combobox", { name: "History status", exact: true }).selectOption("Partially approved");
  await page.getByRole("searchbox", { name: "Search review history", exact: true }).fill("AVELMERE probab");
  await page.getByRole("combobox", { name: "History account", exact: true }).selectOption("account_001");
  await historyList(page).locator("summary").first().click();
  const fields = page.getByRole("region", { name: "Field outcomes", exact: true });
  await expect(fields).toContainText("Skipped");
  await expect(fields).toContainText("Applied");
  await expect(fields).toContainText("Edited suggestion");
  await expect(fields).toContainText("55%");
  await page.getByRole("combobox", { name: "History status", exact: true }).selectOption("Approved");
  await expect(page.getByText("No matching review history. Try another search or filter.")).toBeVisible();
  await page.getByRole("link", { name: "Open Review Queue", exact: true }).click();
  await expect(page.getByRole("list", { name: "Review proposals", exact: true }).getByRole("button", { name: /^Avelmere Systems · Partially approved/ })).toBeVisible();
});

test("history: approved fields and completed status survive reload", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await openHistory(page);
  await page.getByRole("combobox", { name: "History status", exact: true }).selectOption("Approved");
  await historyList(page).locator("summary").first().click();
  await expect(page.getByRole("region", { name: "Field outcomes", exact: true })).toContainText("Applied");
  await page.getByRole("article").getByRole("link", { name: "Link to this review", exact: true }).click();
  await expect(page).toHaveURL(/\/reviews\/history\?proposal=proposal_001$/);
  await page.reload();
  await expect(page.getByRole("article")).toContainText("Final outcome: Approved");
  await expect(badge(page, 14)).toBeVisible();
});

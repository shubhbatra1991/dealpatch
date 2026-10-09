import { expect } from "@playwright/test";
import { badge, editProbability, expectDeal, notifications, openFirstReview, review, test, workspaceFixture } from "./workspace";

test("approve all updates the badge, Deal Detail and survives reload", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(notifications(page)).toContainText("Approved 2 changes");
  await expect(badge(page, 14)).toBeVisible();
  await expect(review(page).getByRole("region", { name: "Review outcome" })).toContainText("Approval complete");
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 45, "Evaluation");
  await page.reload();
  await expectDeal(page, 45, "Evaluation");
  await expect(badge(page, 14)).toBeVisible();
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Proposal approved", exact: true })).toHaveCount(2);
  await page.goto("/workspace/reviews?proposal=proposal_001");
  await expect(review(page).getByRole("region", { name: "Review outcome" })).toContainText("Approval complete");
  await expect(review(page).getByRole("button", { name: "Approve all (0)", exact: true })).toBeDisabled();
});

test("partial approval preserves skipped changes and pending work", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("checkbox", { name: /^Select Probability on/ }).uncheck();
  await review(page).getByRole("button", { name: "Approve selected (1)", exact: true }).click();
  await expect(notifications(page)).toContainText("Approved 1 change");
  await expect(review(page).getByRole("region", { name: "Review outcome" })).toContainText("Partially approved");
  await expect(review(page)).toContainText("Skipped");
  await expect(badge(page, 15)).toBeVisible();
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Evaluation");
  await page.reload();
  await expectDeal(page, 20, "Evaluation");
});

test("edited values validate, remain suggestions until approval, and persist", async ({ page }) => {
  await openFirstReview(page);
  await editProbability(page, "101");
  await expect(review(page).getByRole("alert")).toContainText("<=100");
  await expect(page.getByRole("textbox", { name: "Edit proposed probability" })).toBeFocused();
  await page.getByRole("textbox", { name: "Edit proposed probability" }).fill("55");
  await page.getByRole("button", { name: "Save edit", exact: true }).click();
  await expect(review(page)).toContainText("Edited · awaiting approval");
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.goto("/workspace/reviews?proposal=proposal_001");
  await expect(review(page)).toContainText("55%");
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(notifications(page)).toContainText("Approved 2 changes");
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 55, "Evaluation");
});

test("reject preserves evidence and CRM values and updates the pending badge", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Reject proposal", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await expect(review(page).getByRole("region", { name: "Review outcome" })).toContainText("rejected");
  await page.reload();
  await page.getByRole("combobox", { name: "Proposal status" }).selectOption("Rejected");
  await expect(page.getByRole("list", { name: "Review proposals" }).getByRole("button")).toHaveCount(1);
  await expect(review(page)).toContainText("Supporting evidence");
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Proposal rejected", exact: true })).toBeVisible();
});

test("stale values show captured/current/proposed values and block unsafe approval", async ({ page }) => {
  await openFirstReview(page);
  await workspaceFixture(page, "change-deal");
  await page.getByRole("button", { name: "Refresh current values", exact: true }).click();
  await expect(review(page)).toContainText("Stale · approval blocked");
  const conflict = review(page).getByRole("listitem").filter({ hasText: "Original captured value:" });
  await expect(conflict).toContainText("20%");
  await expect(conflict).toContainText("35%");
  await expect(conflict).toContainText("45%");
  await expect(conflict.getByRole("checkbox")).toBeDisabled();
  await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeDisabled();
  await expect(badge(page, 15)).toBeVisible();
  await page.screenshot({ path: "test-results/manual-conflict.png", fullPage: true });
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 35, "Discovery");
});

test("a concurrent local edit rolls back an optimistic approval atomically", async ({ page }) => {
  await openFirstReview(page);
  // Do not refresh: the UI still displays 20%, while persistence has 35%.
  await workspaceFixture(page, "change-deal");
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(notifications(page).getByRole("alert")).toContainText("Approval failed. Previous values and the proposal were restored.");
  await expect(review(page)).toContainText("Stale · approval blocked");
  await expect(badge(page, 15)).toBeVisible();
  await page.screenshot({ path: "test-results/manual-rollback.png", fullPage: true });
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 35, "Discovery");
  await page.reload();
  await expectDeal(page, 35, "Discovery");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Change history" })).toContainText("No audit events recorded");
});

test("undo restores original values and proposal while preserving approval audit events", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await notifications(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(notifications(page)).toContainText("Approval undone");
  await expect(badge(page, 15)).toBeVisible();
  await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeEnabled();
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Proposal approved", exact: true })).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Approval undone", exact: true })).toHaveCount(2);
  await page.reload();
  await expectDeal(page, 20, "Discovery");
});

test("a storage abort rolls back CRM, proposal, badge and audit then allows retry", async ({ page }) => {
  await openFirstReview(page);
  // Isolated fault injection: abort a real transaction at its first audit insert,
  // after the entity write. No repository or persistence substitute is used.
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      if (this.name === "auditEvents") {
        IDBObjectStore.prototype.add = original;
        this.transaction.abort();
        throw new DOMException("Injected storage failure for browser validation", "AbortError");
      }
      return original.apply(this, args);
    };
  });
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(notifications(page).getByRole("alert")).toContainText("Approval failed. Previous values and the proposal were restored.");
  await expect(badge(page, 15)).toBeVisible();
  await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeEnabled();
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.reload();
  await expectDeal(page, 20, "Discovery");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("region", { name: "Change history" })).toContainText("No audit events recorded");
  await page.goto("/workspace/reviews?proposal=proposal_001");
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
});

test("unsafe Undo preserves a newer local edit and reports the conflict", async ({ page }) => {
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await workspaceFixture(page, "change-deal", 60);
  await notifications(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(notifications(page).getByRole("alert")).toContainText("Undo failed. No saved changes were made.");
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 60, "Evaluation");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Approval undone", exact: true })).toHaveCount(0);
});

test("keyboard navigation, dialog focus restoration, checkbox Space and safe typing", async ({ page }) => {
  const rows = page.getByRole("list", { name: "Review proposals" }).getByRole("button");
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "true");
  await page.keyboard.press("k");
  await expect(rows.first()).toBeFocused();
  await page.keyboard.press("j");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rows.nth(1)).toBeFocused();
  await openFirstReview(page);
  const stage = review(page).getByRole("checkbox", { name: /^Select Stage on/ });
  await stage.focus();
  await page.keyboard.press("Space");
  await expect(stage).not.toBeChecked();
  await review(page).getByRole("button", { name: /^Edit Probability on/ }).click();
  const editor = page.getByRole("textbox", { name: "Edit proposed probability" });
  await editor.fill("");
  await editor.pressSequentially("arkj");
  await expect(editor).toHaveValue("arkj");
  await expect(badge(page, 15)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(review(page).getByRole("button", { name: /^Edit Probability on/ })).toBeFocused();
  await review(page).focus();
  await page.keyboard.press("a");
  await expect(notifications(page)).toContainText("Approved 1 change");
  await expect(badge(page, 15)).toBeVisible();
  await review(page).focus();
  await page.keyboard.press("r");
  await expect(badge(page, 14)).toBeVisible();
});

test("golden path: Activity → edit → partial approval → Deal audit → Undo", async ({ page }) => {
  await workspaceFixture(page, "remove-source-proposal");
  await page.goto("/workspace/activity?activity=activity_003");
  await expect(badge(page, 14)).toBeVisible();
  await page.getByRole("button", { name: "Run simulated analysis", exact: true }).click();
  const agent = page.getByRole("region", { name: "Demo intelligence" });
  await expect(agent).toContainText("Running");
  await expect(agent.getByRole("heading", { name: "Generated proposal", exact: true })).toBeVisible();
  await expect(agent).toContainText("88% demo confidence");
  await expect(agent.getByRole("list", { name: "Simulated analysis events" }).getByText("Complete", { exact: true })).toHaveCount(7);
  await expect(badge(page, 14)).toBeVisible();
  await agent.getByRole("button", { name: "Send to Review Queue", exact: true }).click();
  await expect(agent).toContainText("Proposal saved for human review.");
  await expect(badge(page, 15)).toBeVisible();
  await agent.getByRole("link", { name: "Open Review", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await editProbability(page, "55");
  await expect(review(page)).toContainText("Edited · awaiting approval");
  await review(page).getByRole("checkbox", { name: /^Select Stage on/ }).uncheck();
  await review(page).getByRole("button", { name: "Approve selected (1)", exact: true }).click();
  await expect(notifications(page)).toContainText("Approved 1 change");
  await expect(review(page).getByRole("region", { name: "Review outcome" })).toContainText("Partially approved");
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expectDeal(page, 55, "Discovery");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Proposal partially approved", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Proposed value edited", exact: true })).toBeVisible();
  await notifications(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(notifications(page)).toContainText("Approval undone");
  await expect(page.getByRole("heading", { name: "Approval undone", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expectDeal(page, 20, "Discovery");
  await page.reload();
  await expectDeal(page, 20, "Discovery");
  await page.goto("/workspace/activity?activity=activity_003");
  await expect(page.getByText("Already in Review Queue", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run simulated analysis", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "Open Review", exact: true }).click();
  await expect(review(page)).toContainText("55%");
  await expect(review(page)).toContainText("Edited · awaiting approval");
  await expect(badge(page, 15)).toBeVisible();
});

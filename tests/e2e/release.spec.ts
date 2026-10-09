import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { badge, openFirstReview, review } from "./workspace";

async function changeRecord(page: Page, store: string, id: string, patch?: Record<string, unknown>) {
  await page.evaluate(async ({ store, id, patch }) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("dealpatch");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction(store, "readwrite");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
        const table = tx.objectStore(store);
        if (!patch) table.delete(id);
        else { const record = table.get(id); record.onsuccess = () => table.put({ ...record.result, ...patch }); }
      };
    });
  }, { store, id, patch });
}

async function resetDemo(page: Page) {
  await page.route("**/__release-reset.js", async route => route.fulfill({ contentType: "application/javascript", body: await readFile("node_modules/.cache/dealpatch-browser-test/reset.js") }));
  await page.addScriptTag({ url: "/__release-reset.js" });
  await page.evaluate(() => (Reflect.get(window, "DealPatchReleaseTest") as { resetWorkspace(): Promise<void> }).resetWorkspace());
  await page.reload();
}

test("release: clean profile, complete workflow, persistence, console and network", async ({ page, browserName }) => {
  test.setTimeout(90_000);
  const errors: string[] = [], external: string[] = [], failures: string[] = [];
  const aborted: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  page.on("request", request => { if (new URL(request.url()).origin !== "http://localhost:3100") external.push(request.url()); });
  page.on("response", response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  page.on("requestfailed", request => {
    const reason = request.failure()?.errorText;
    if (reason && /ABORT|cancel|interrupt/i.test(reason)) aborted.push(`${reason} ${request.url()}`);
    else if (reason) failures.push(`${reason} ${request.url()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Human-reviewed automation");
  expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
  await expect(page.getByRole("combobox", { name: "Theme", exact: true })).toHaveValue("auto");
  if (browserName === "chromium") {
    await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("night");
    await page.screenshot({ path: "docs/images/landing.png", animations: "disabled" });
  }
  await page.getByRole("main").getByRole("link", { name: "Explore workspace", exact: true }).first().click();
  await expect(badge(page, 15)).toBeVisible();
  await expect(page.getByText("No favorites yet", { exact: true })).toBeVisible();
  await expect(page.getByText("No saved views yet", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("night");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("link", { name: "Pipeline", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "60 of 60 deals" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search deals" }).fill("Avelmere");
  await expect(page.getByRole("status").filter({ hasText: "2 of 60 deals" })).toBeVisible();
  await navigation.getByRole("link", { name: "Accounts", exact: true }).click();
  await page.getByRole("main").getByRole("link", { name: "Avelmere Systems", exact: true }).click();
  await page.getByRole("button", { name: "Add Avelmere Systems to favorites", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Avelmere Systems from favorites", exact: true })).toBeEnabled();
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove Avelmere Systems from favorites", exact: true })).toBeVisible();
  await navigation.getByRole("link", { name: "Pipeline", exact: true }).click();
  await page.getByRole("combobox", { name: "Risk", exact: true }).selectOption("High");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save Pipeline view", exact: true });
  await dialog.getByRole("textbox", { name: "View name", exact: true }).fill("Release check");
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: "Release check", exact: true }).click();
  await expect(page).toHaveURL(/\/workspace\/pipeline\?view=/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Risk", exact: true })).toHaveValue("High");
  await page.getByRole("button", { name: "Search workspace", exact: true }).click();
  await page.getByRole("combobox", { name: /^Search accounts/ }).fill("Avelmere");
  await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/workspace/activity?activity=activity_003");
  // Remove the preseeded source proposal, then exercise real simulation/persistence.
  await changeRecord(page, "proposals", "proposal_001");
  await page.reload();
  await expect(badge(page, 14)).toBeVisible();
  await page.getByRole("button", { name: "Run simulated analysis", exact: true }).click();
  const agent = page.getByRole("region", { name: "Demo intelligence" });
  await expect(agent.getByRole("heading", { name: "Generated proposal", exact: true })).toBeVisible();
  await agent.getByRole("button", { name: "Send to Review Queue", exact: true }).click();
  await expect(badge(page, 15)).toBeVisible();
  await agent.getByRole("link", { name: "Open Review", exact: true }).click();
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await review(page).getByRole("link", { name: "View deal", exact: true }).click();
  await expect(page.getByText("Probability", { exact: true }).locator("..").getByRole("definition")).toHaveText("45%");
  await page.reload();
  await expect(page.getByText("Probability", { exact: true }).locator("..").getByRole("definition")).toHaveText("45%");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  await page.getByRole("tab", { name: "Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Proposal approved", exact: true })).toHaveCount(2);
  await test.info().attach("production-observations", { body: JSON.stringify({ errors, external, failures, aborted }), contentType: "application/json" });
  expect(errors).toEqual([]); expect(external).toEqual([]); expect(failures).toEqual([]);
});

test("release: real reset restores seed and clears generated work, favorites and views", async ({ page }) => {
  await page.goto("/workspace/accounts/account_001");
  await expect(badge(page, 15)).toBeVisible();
  await page.getByRole("button", { name: "Add Avelmere Systems to favorites", exact: true }).click();
  await page.goto("/workspace/pipeline");
  await page.getByRole("button", { name: "Save view", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Save Pipeline view", exact: true });
  await dialog.getByRole("textbox", { name: "View name", exact: true }).fill("Reset fixture");
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await page.goto("/workspace/reviews");
  await openFirstReview(page);
  await review(page).getByRole("button", { name: "Approve all (2)", exact: true }).click();
  await expect(badge(page, 14)).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("dealpatch");
      open.onsuccess = () => {
        const db = open.result, tx = db.transaction("proposals", "readwrite"), table = tx.objectStore("proposals");
        const record = table.get("proposal_002");
        record.onsuccess = () => table.add({ ...record.result, id: "release-generated-proposal" });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
      open.onerror = () => reject(open.error);
    });
  });
  await changeRecord(page, "deals", "deal_001", { probability: 37 });
  await changeRecord(page, "proposals", "proposal_001");
  await resetDemo(page);
  await expect(badge(page, 15)).toBeVisible();
  await expect(page.getByText("No favorites yet", { exact: true })).toBeVisible();
  await expect(page.getByText("No saved views yet", { exact: true })).toBeVisible();
  expect(await page.evaluate(async () => new Promise<Record<string, number>>((resolve, reject) => {
    const open = indexedDB.open("dealpatch");
    open.onsuccess = () => {
      const db = open.result, names = Array.from(db.objectStoreNames), tx = db.transaction(names), counts: Record<string, number> = {};
      for (const name of names) { const count = tx.objectStore(name).count(); count.onsuccess = () => { counts[name] = count.result; }; }
      tx.oncomplete = () => { db.close(); resolve(counts); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    };
    open.onerror = () => reject(open.error);
  }))).toEqual({ accounts: 30, contacts: 80, deals: 60, activities: 150, proposals: 15, auditEvents: 0, favorites: 0, savedViews: 0 });
  await page.goto("/workspace/deals/deal_001");
  await expect(page.getByText("Probability", { exact: true }).locator("..").getByRole("definition")).toHaveText("20%");
  await page.reload();
  await expect(badge(page, 15)).toBeVisible();
});

test("release: corrupt data, missing relationships and invalid IDs fail visibly", async ({ page }) => {
  await page.goto("/workspace/reviews"); await expect(badge(page, 15)).toBeVisible();
  await changeRecord(page, "deals", "deal_001", { probability: "malformed" });
  await page.goto("/workspace/pipeline");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to load the pipeline from local storage");
  await resetDemo(page);
  await changeRecord(page, "accounts", "account_001");
  await page.goto("/workspace/reviews");
  await expect(review(page)).toContainText("Missing account");
  await page.goto("/workspace/deals/not-a-record");
  await expect(page.getByRole("heading", { name: "Deal not found", exact: true })).toBeVisible();
  await page.goto("/workspace/accounts/not-a-record");
  await expect(page.getByRole("heading", { name: "Account not found", exact: true })).toBeVisible();
  await page.goto("/workspace/contacts/not-a-record");
  await expect(page.getByRole("heading", { name: "Contact not found", exact: true })).toBeVisible();
});

test("release: unavailable IndexedDB shows a retryable error", async ({ page }) => {
  await page.addInitScript(() => { IDBFactory.prototype.open = () => { throw new DOMException("Storage unavailable for release test", "SecurityError"); }; });
  await page.goto("/workspace");
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Retry", exact: true })).toBeVisible();
});

import { expect, test as base, type Page } from "@playwright/test";
import type { Deal } from "../../domain/deals/deal";

export const badge = (page: Page, count: number) => page.getByRole("link", { name: `Review Queue ${count} pending`, exact: true });
export const review = (page: Page) => page.getByRole("article");
export const notifications = (page: Page) => page.getByRole("region", { name: "Review notifications" });

/** Native IndexedDB is used only to reset fixtures or simulate another local writer.
 * All workflow interactions and assertions go through the actual application UI.
 */
export async function workspaceFixture(page: Page, operation: "clear" | "remove-source-proposal" | "change-deal", probability = 35) {
  await page.evaluate(async ({ operation, probability }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("dealpatch");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const names = operation === "clear" ? Array.from(db.objectStoreNames) : [operation === "change-deal" ? "deals" : "proposals"];
        const tx = db.transaction(names, "readwrite");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
        if (operation === "clear") for (const name of names) tx.objectStore(name).clear();
        else if (operation === "remove-source-proposal") tx.objectStore("proposals").delete("proposal_001");
        else {
          const store = tx.objectStore("deals");
          const record = store.get("deal_001");
          record.onsuccess = () => store.put({ ...(record.result as Deal), probability });
        }
      };
    });
  }, { operation, probability });
}

export const test = base.extend({
  page: async ({ page }, runTest) => {
    // Each test also has a fresh browser context. Exercise the real empty-store
    // initializer after clearing all tables, including append-only audit history.
    await page.goto("/reviews");
    await expect(badge(page, 15)).toBeVisible();
    await workspaceFixture(page, "clear");
    await page.reload();
    await expect(badge(page, 15)).toBeVisible();
    await expect(page.getByRole("list", { name: "Review proposals" }).getByRole("button")).toHaveCount(15);
    await runTest(page);
  },
});

export async function openFirstReview(page: Page) {
  await page.getByRole("list", { name: "Review proposals" }).getByRole("button", { name: "Avelmere Systems · Pending · 2 changes", exact: true }).click();
  await expect(review(page).getByRole("button", { name: "Approve all (2)", exact: true })).toBeEnabled();
}

export async function expectDeal(page: Page, probability: number, stage: string) {
  await expect(page.getByRole("heading", { name: "Avelmere Systems — Commercial workflow rollout", exact: true })).toBeVisible();
  // A definition list associates the displayed metric with its term; no CSS layout assumptions.
  await expect(page.getByText("Probability", { exact: true }).locator("..").getByRole("definition")).toHaveText(`${probability}%`);
  await expect(page.getByRole("region", { name: "Deal health" })).toContainText(`${stage} ·`);
}

export async function editProbability(page: Page, value: string) {
  await review(page).getByRole("button", { name: /^Edit Probability on/ }).click();
  await page.getByRole("textbox", { name: "Edit proposed probability" }).fill(value);
  await page.getByRole("button", { name: "Save edit", exact: true }).click();
}

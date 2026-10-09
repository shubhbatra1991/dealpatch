import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadSeedData } from "../../lib/db/seed";
import { generateStressWorkspace, stressSizes } from "../../lib/simulation/generate-stress-workspace";
import { seedDataSchema } from "../../data/seed/validate";

test.use({ actionTimeout: 15_000 });

test("performance: stress workspace structural checks and production observations", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const samples: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    const tasks: number[] = [];
    const commits: Record<string, number> = {};
    type Fiber = { child?: Fiber; sibling?: Fiber; flags?: number; elementType?: { displayName?: string }; type?: { name?: string; displayName?: string }; };
    Object.assign(window, { __dealpatchProfile: { tasks, commits } });
    Object.assign(window, { __REACT_DEVTOOLS_GLOBAL_HOOK__: {
      supportsFiber: true, inject: () => 1,
      onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
        function walk(fiber?: Fiber) {
          if (!fiber) return;
          const name = fiber.elementType?.displayName || fiber.type?.displayName || fiber.type?.name;
          if (name && ((fiber.flags ?? 0) & 1)) commits[name] = (commits[name] ?? 0) + 1;
          walk(fiber.child); walk(fiber.sibling);
        }
        walk(root.current);
      },
      onCommitFiberUnmount: () => {},
    } });
    new PerformanceObserver(list => { for (const entry of list.getEntries()) tasks.push(entry.duration); }).observe({ type: "longtask", buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  async function sample(label: string, action: () => Promise<unknown>) {
    const start = performance.now();
    await action();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const elapsedMs = performance.now() - start;
    const metrics = await cdp.send("Performance.getMetrics");
    samples.push({ label, elapsedMs, metrics: Object.fromEntries(metrics.metrics.filter((metric: { name: string }) => ["Nodes", "JSHeapUsedSize", "LayoutDuration", "RecalcStyleDuration", "ScriptDuration"].includes(metric.name)).map((metric: { name: string; value: number }) => [metric.name, metric.value])), browser: await page.evaluate(() => ({ elements: document.getElementsByTagName("*").length, profile: Reflect.get(window, "__dealpatchProfile"), scripts: performance.getEntriesByType("resource").filter(entry => entry.name.includes("/_next/static/") && entry.name.endsWith(".js")).map(entry => ({ url: entry.name, encoded: (entry as PerformanceResourceTiming).encodedBodySize, decoded: (entry as PerformanceResourceTiming).decodedBodySize })) })) });
    process.stdout.write(`${label}: ${Math.round(elapsedMs)} ms\n`);
  }
  await page.goto("/reviews");
  await expect(page.getByRole("link", { name: "Review Queue 15 pending", exact: true })).toBeVisible();
  const data = seedDataSchema.parse(generateStressWorkspace(loadSeedData()));
  await page.evaluate(async data => {
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open("dealpatch");
      opening.onsuccess = () => {
        const db = opening.result;
        const tx = db.transaction(Array.from(db.objectStoreNames), "readwrite");
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
        for (const name of Array.from(db.objectStoreNames)) tx.objectStore(name).clear();
        for (const [name, records] of Object.entries(data)) for (const record of records) tx.objectStore(name).add(record);
      };
      opening.onerror = () => reject(opening.error);
    });
  }, data);
  try {
    await sample("pipeline initial", async () => { await page.goto("/pipeline"); await expect(page.getByRole("status").filter({ hasText: "5000 of 5000 deals" })).toBeVisible(); });
    const pipeline = page.getByRole("region", { name: "Pipeline deals, scroll horizontally for more columns" });
    expect(await pipeline.locator("tr[data-row-id]").count()).toBeLessThan(80);
    samples.push({ label: "pipeline rendered rows", count: await pipeline.locator("tr[data-row-id]").count() });
    await sample("pipeline scroll/end keyboard", async () => { await pipeline.press("End"); await expect(pipeline.locator("tr[data-row-id]").last()).toHaveAttribute("aria-rowindex", "5001"); });
    expect(await pipeline.locator("tr[data-row-id]").count()).toBeLessThan(80);
    await sample("pipeline sort", () => page.getByRole("button", { name: /^Value/ }).click());
    await sample("pipeline filter", async () => { await page.getByRole("combobox", { name: "Risk", exact: true }).selectOption("High"); await expect(page.getByRole("status").filter({ hasText: /of 5000 deals/ })).not.toContainText("5000 of"); });
    await sample("pipeline stage filter", () => page.getByRole("combobox", { name: "Stage", exact: true }).selectOption("Evaluation"));
    await sample("pipeline search", () => page.getByRole("searchbox", { name: "Search deals" }).fill("rollout"));
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    const columns = page.locator("summary").filter({ hasText: /^Columns/ });
    await sample("pipeline column visibility", async () => { await columns.click(); await page.getByRole("checkbox", { name: "Next Step", exact: true }).uncheck(); await expect(pipeline.getByRole("columnheader", { name: /^Next Step/ })).toHaveCount(0); });
    await columns.press("Escape");
    await sample("pipeline selection", async () => { await pipeline.locator("tr[data-row-id]").first().getByRole("checkbox").check(); await expect(page.getByRole("status").filter({ hasText: /of 5000 deals/ })).toContainText("1 selected"); });
    await sample("contacts initial", async () => { await page.goto("/contacts"); await expect(page.getByRole("status").filter({ hasText: "10000 of 10000 contacts" })).toBeVisible({ timeout: 60_000 }); });
    samples.push({ label: "contact rendered rows", count: await page.locator("tbody tr").count() });
    expect(await page.locator("tbody tr").count()).toBeLessThan(80);
    await sample("contacts scrolling/keyboard", async () => { const table = page.getByRole("region", { name: "Contacts table, scroll horizontally for more columns" }); await table.press("End"); await expect(table.locator("tr[data-contact-row]").last()).toHaveAttribute("aria-rowindex", "10001"); });
    await sample("contacts search", async () => { await page.getByRole("searchbox", { name: "Search contacts" }).fill("contact10000@"); await expect(page.getByRole("status").filter({ hasText: "1 of 10000 contacts" })).toBeVisible(); });
    await sample("contacts filter", () => page.getByRole("combobox", { name: "Status", exact: true }).selectOption("Active"));
    await sample("contacts sort", () => page.getByRole("button", { name: /^Name/ }).click());
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await sample("contacts account and region filters", async () => { await page.getByRole("combobox", { name: "Account", exact: true }).selectOption("stress-account-2"); await expect(page.getByRole("status").filter({ hasText: "of 10000 contacts" })).toContainText("20 of"); await page.getByRole("combobox", { name: "Region", exact: true }).selectOption(data.accounts[1].region!); });
    await sample("activity initial", async () => { await page.goto("/activity"); await expect(page.getByRole("status").filter({ hasText: "25000 of 25000 activities" })).toBeVisible({ timeout: 90_000 }); });
    samples.push({ label: "activity rendered rows", count: await page.getByRole("list", { name: "Activity feed" }).getByRole("button").count() });
    expect(await page.getByRole("list", { name: "Activity feed" }).getByRole("button").count()).toBeLessThan(30);
    const renderedBefore = await page.evaluate(() => Number(Reflect.get(window, "__dealpatchProfile").commits.ActivityFeedRow ?? 0));
    await sample("activity selection", () => page.getByRole("list", { name: "Activity feed" }).getByRole("button").nth(1).click());
    await expect(page.getByRole("region", { name: "Selected activity" }).getByRole("heading", { name: "Commercial follow-up 24999", exact: true })).toBeVisible();
    const renderedAfter = await page.evaluate(() => Number(Reflect.get(window, "__dealpatchProfile").commits.ActivityFeedRow ?? 0));
    samples.push({ label: "activity selection row render delta", count: renderedAfter - renderedBefore });
    // Production React fiber names/flags are diagnostic only, not a public API
    // or a CI assertion. Bounded mounted rows above is the regression contract.
    await sample("simulation start", async () => { await page.getByRole("button", { name: "Run simulated analysis", exact: true }).click(); await expect(page.getByRole("region", { name: "Demo intelligence" }).getByRole("status").filter({ hasText: "Simulated analysis started." })).toHaveCount(1); });
    await page.getByRole("list", { name: "Activity feed" }).getByRole("button").nth(2).click();
    await expect(page.getByRole("region", { name: "Demo intelligence" })).toContainText("Waiting · Ready to analyze");
    await sample("activity type filter", () => page.getByRole("combobox", { name: "Activity type" }).selectOption("Email"));
    await sample("activity account filter", () => page.getByRole("combobox", { name: "Account", exact: true }).selectOption("stress-account-2"));
    await sample("activity search", () => page.getByRole("searchbox", { name: "Search activities" }).fill("rollout"));
    await expect(page.getByRole("status").filter({ hasText: "50 of 25000 activities" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters", exact: true }).click();
    await sample("activity scrolling/keyboard", async () => { const feed = page.getByRole("list", { name: "Activity feed" }); await feed.getByRole("button").first().press("End"); await expect(page.getByRole("region", { name: "Selected activity" }).getByRole("heading", { name: "Commercial follow-up 1", exact: true })).toBeVisible(); expect(await feed.getByRole("button").count()).toBeLessThan(30); });
    await page.getByRole("heading", { name: "Activity", exact: true }).click();
    await sample("search open", async () => { await page.keyboard.press("Control+k"); await expect(page.getByRole("dialog", { name: "Search workspace", exact: true })).toBeVisible(); });
    await sample("search input", async () => { await page.getByRole("combobox", { name: "Search accounts, contacts, deals, reviews and activities" }).fill("commercial"); await expect(page.getByRole("listbox", { name: "Workspace search results" }).getByRole("option").first()).toBeVisible(); });
    const grouped = page.getByRole("listbox", { name: "Workspace search results" });
    await expect(grouped.getByRole("group", { name: /^Deals,/ })).toBeVisible();
    await expect(grouped.getByRole("group", { name: /^Activities,/ })).toBeVisible();
    await sample("search keyboard", () => page.getByRole("combobox", { name: "Search accounts, contacts, deals, reviews and activities" }).press("ArrowDown"));
    expect(await page.getByRole("listbox", { name: "Workspace search results" }).getByRole("option").count()).toBeLessThanOrEqual(30);
    await page.keyboard.press("Escape");
    await sample("reviews initial", async () => { await page.goto("/reviews"); await expect(page.getByRole("link", { name: "Review Queue 1000 pending", exact: true })).toBeVisible(); await expect(page.getByRole("list", { name: "Review proposals" }).getByRole("button").first()).toBeVisible(); });
    expect(await page.getByRole("list", { name: "Review proposals" }).getByRole("button").count()).toBeLessThan(30);
    await sample("reviews keyboard End", async () => { const list = page.getByRole("list", { name: "Review proposals" }); await list.getByRole("button").first().press("End"); await expect(list.getByRole("listitem").last()).toHaveAttribute("aria-posinset", "1000"); });
    await sample("reviews navigation", () => page.getByRole("list", { name: "Review proposals" }).getByRole("button").first().press("ArrowDown"));
    await sample("reviews change selection", async () => { const change = page.getByRole("article").getByRole("checkbox"); await change.uncheck(); await expect(page.getByRole("article").getByRole("button", { name: "Approve selected (0)", exact: true })).toBeDisabled(); await change.check(); });
    await sample("reviews approval", async () => { await page.getByRole("article").getByRole("button", { name: "Approve all (1)", exact: true }).click(); await expect(page.getByRole("link", { name: "Review Queue 999 pending", exact: true })).toBeVisible(); });
    for (const [path, name] of [["/", "overview"], ["/accounts", "accounts"], ["/deals/performance-deal-1", "deal detail"]]) await sample(`${name} initial`, async () => { await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); await expect(page.getByRole("link", { name: "Review Queue 999 pending", exact: true })).toBeVisible(); await expect(page.getByText(/Loading (local|account|deal)/)).toHaveCount(0); });
    await cdp.send("HeapProfiler.collectGarbage");
    await sample("retained memory after GC", async () => {});
    for (const route of ["/pipeline", "/activity", "/contacts", "/reviews"]) { await page.goto(route); await expect(page.getByRole("link", { name: "Review Queue 999 pending", exact: true })).toBeVisible(); }
    await cdp.send("HeapProfiler.collectGarbage");
    await sample("retained memory after another route cycle and GC", async () => {});
  } finally {
    await writeFile(testInfo.outputPath("performance.json"), JSON.stringify({ sizes: stressSizes, measurements: "Node wall clock around user action + readiness assertion + two animation frames; CDP metrics cumulative per document; long tasks >=50ms; no CPU/network throttling", samples }, null, 2));
    await testInfo.attach("production-performance", { path: testInfo.outputPath("performance.json"), contentType: "application/json" });
  }
});

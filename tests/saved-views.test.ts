import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Dexie from "dexie";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import type { SavedView } from "../domain/saved-views/saved-view";
import { savedViewSchema } from "../domain/saved-views/schema";
import { DealPatchDatabase } from "../lib/db/database";
import { DATABASE_VERSION, VERSION_3_STORES } from "../lib/db/schema";
import { resetWorkspace } from "../lib/db/workspace";
import { createSavedViewRepository } from "../lib/repositories/saved-views";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { defaultPipelineView, capturePipelineView, restorePipelineView } from "../features/pipeline/pipeline-view-state";
import { PipelineTable } from "../features/pipeline/pipeline-table";
import { PipelineWorkspace } from "../features/pipeline/pipeline-workspace";
import { SavedViewsSection, savedViewHref } from "../features/saved-views/saved-views-section";
import { savedViewMutationOptions } from "../features/saved-views/use-saved-views";
import { renderWithKeyboard } from "./keyboard-provider";

const config = capturePipelineView("  renewal  ", [{ id: "stage", value: "Negotiation" }, { id: "risk", value: "High" }], [{ id: "value", desc: true }], { ownerId: false, lastActivityAt: false });

async function workspace(run: (db: DealPatchDatabase, repo: ReturnType<typeof createSavedViewRepository>) => Promise<void>) {
  const db = new DealPatchDatabase(`saved-views-${randomUUID()}`);
  try { const repo = createSavedViewRepository(db); await repo.getAll(); await run(db, repo); }
  finally { await db.delete(); }
}

test("saved view creation stores configuration only, survives reopen, renames and deletes", async () => {
  await workspace(async (db, repo) => {
    const view = await repo.create({ ...config, entityType: "pipeline", name: "  High-risk closers  " });
    assert.equal(view.name, "High-risk closers");
    assert.equal(view.createdAt, view.updatedAt);
    assert.deepEqual(Object.keys(view).sort(), ["createdAt", "entityType", "filters", "id", "name", "search", "sorting", "updatedAt", "visibleColumns"]);
    db.close(); await db.open();
    assert.deepEqual(await repo.getAll(), [view]);
    const renamed = await repo.rename(view.id, "Negotiation renewals");
    assert.equal(renamed.name, "Negotiation renewals");
    assert.equal(renamed.createdAt, view.createdAt);
    assert.ok(renamed.updatedAt >= view.updatedAt);
    assert.deepEqual(restorePipelineView(renamed), restorePipelineView(config));
    await repo.delete(view.id);
    assert.deepEqual(await repo.getAll(), []);
    await repo.delete(view.id);
    await assert.rejects(repo.rename(view.id, "Gone"), /no longer available/);
  });
});

test("duplicate names are rejected case-insensitively for create, rename and concurrent connections", async () => {
  await workspace(async (db, repo) => {
    const view = await repo.create({ ...config, name: "Closers", entityType: "pipeline" });
    await assert.rejects(repo.create({ ...config, name: " CLOSERS ", entityType: "pipeline" }), /already exists/);
    const other = await repo.create({ ...defaultPipelineView, name: "Other", entityType: "pipeline" });
    await assert.rejects(repo.rename(other.id, "closers"), /already exists/);
    assert.equal((await repo.rename(view.id, "closers")).name, "closers");
    const connection = new DealPatchDatabase(db.name);
    try {
      const second = createSavedViewRepository(connection);
      const attempts = await Promise.allSettled([repo.create({ ...config, name: "Race", entityType: "pipeline" }), second.create({ ...config, name: " RACE ", entityType: "pipeline" })]);
      assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
      assert.equal((await repo.getAll()).length, 3);
    } finally { connection.close(); }
  });
});

test("invalid configurations and persisted views fail validation without writing or applying filters", async () => {
  await workspace(async (db, repo) => {
    const input = { ...config, name: "Example", entityType: "pipeline" as const };
    for (const invalid of [
      { ...input, name: "  " }, { ...input, name: "x".repeat(81) },
      { ...input, entityType: "accounts" }, { ...input, filters: { stage: "Unknown" } },
      { ...input, filters: { risk: "Severe" } }, { ...input, filters: { region: "North" } },
      { ...input, sorting: [{ id: "unknown", desc: true }] },
      { ...input, visibleColumns: ["accountName", "title", "title"] },
      { ...input, visibleColumns: ["title"] }, { ...input, visibleColumns: ["accountName", "title", "secret"] },
      { ...input, deals: [] },
    ]) {
      // Runtime boundary coverage deliberately supplies untrusted JSON shapes.
      await assert.rejects(repo.create(invalid as typeof input));
    }
    assert.equal(await db.savedViews.count(), 0);
    const view = await repo.create(input);
    await assert.rejects(repo.rename(view.id, " "));
    assert.deepEqual(await repo.getAll(), [view]);
    assert.equal(savedViewSchema.safeParse({ ...view, createdAt: "yesterday" }).success, false);
    await db.savedViews.update(view.id, { visibleColumns: ["title"] });
    await assert.rejects(repo.getAll());
  });
});

test("version 4 adds empty saved views without altering favorites, business records or audit history", async () => {
  const name = `saved-view-migration-${randomUUID()}`;
  const previous = new Dexie(name);
  previous.version(3).stores(VERSION_3_STORES);
  await previous.table("accounts").add({ id: "existing", name: "Local edit" });
  await previous.table("favorites").add({ id: "f", entityType: "account", entityId: "existing", createdAt: new Date().toISOString() });
  await previous.table("auditEvents").add({ id: "history", entityId: "existing" });
  previous.close();
  const db = new DealPatchDatabase(name);
  try {
    await db.open();
    assert.equal(db.verno, DATABASE_VERSION);
    assert.equal((await db.accounts.get("existing"))!.name, "Local edit");
    assert.equal(await db.favorites.count(), 1);
    assert.equal(await db.auditEvents.count(), 1);
    assert.deepEqual(await createSavedViewRepository(db).getAll(), []);
  } finally { await db.delete(); }
});

test("query mutations immediately publish persisted create/rename/delete to the shared sidebar cache", async () => {
  await workspace(async (db, repo) => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.savedViews.list, []);
    const mutate = () => client.getMutationCache().build(client, savedViewMutationOptions(client, repo));
    try {
      const view = (await mutate().execute({ action: "create", config, name: "Renewals" }))!;
      assert.deepEqual(client.getQueryData(queryKeys.savedViews.list), [view]);
      await mutate().execute({ action: "rename", id: view.id, name: "Priority renewals" });
      assert.equal(client.getQueryData<SavedView[]>(queryKeys.savedViews.list)![0].name, "Priority renewals");
      const before = client.getQueryData(queryKeys.savedViews.list);
      const failing = client.getMutationCache().build(client, savedViewMutationOptions(client, { ...repo, delete: async () => { throw new Error("Storage failed"); } }));
      await assert.rejects(failing.execute({ action: "delete", id: view.id }), /Storage failed/);
      assert.deepEqual(client.getQueryData(queryKeys.savedViews.list), before);
      await mutate().execute({ action: "delete", id: view.id });
      assert.deepEqual(client.getQueryData(queryKeys.savedViews.list), []);
      await repo.create({ ...config, name: "Reset me", entityType: "pipeline" });
      await resetWorkspace(db);
      assert.deepEqual(await repo.getAll(), []);
    } finally { client.clear(); }
  });
});

test("restoration reproduces search, exact filters, sort and hidden columns in the actual Pipeline table", async () => {
  await workspace(async (db) => {
    const accounts = await db.accounts.toArray(), deals = await db.deals.toArray();
    const captured = capturePipelineView("", [{ id: "stage", value: "Negotiation" }, { id: "risk", value: "High" }], [{ id: "value", desc: true }], { ownerId: false, nextStep: false });
    const state = restorePipelineView(captured);
    assert.deepEqual(capturePipelineView(state.search, state.columnFilters, state.sorting, state.columnVisibility), captured);
    const html = renderWithKeyboard(createElement(PipelineTable, { accounts, deals, initialView: captured, onSaveView: () => {} }));
    assert.match(html, /Save view/);
    assert.match(html, /value="Negotiation" selected/);
    assert.match(html, /value="High" selected/);
    assert.match(html, /aria-sort="descending"/);
    assert.doesNotMatch(html, /<button[^>]*>Owner/);
    const searched = renderWithKeyboard(createElement(PipelineTable, { accounts, deals, initialView: config }));
    assert.match(searched, /value="  renewal  "/);
    assert.match(searched, /No matching deals/);
  });
});

test("saved-view navigation is URL-addressable, sidebar names are escaped, and missing/loading/error states are explicit", async () => {
  await workspace(async (db, repo) => {
    const client = createQueryClient();
    const render = (element: ReturnType<typeof createElement>) => renderWithKeyboard(createElement(QueryClientProvider, { client }, element));
    try {
      assert.equal(savedViewHref("opaque/id ?#"), "/pipeline?view=opaque%2Fid%20%3F%23");
      assert.match(render(createElement(PipelineWorkspace, { savedViewId: "missing" })), /Loading saved view/);
      client.setQueryData(queryKeys.savedViews.list, []);
      assert.match(render(createElement(SavedViewsSection)), /No saved views yet/);
      const view = await repo.create({ ...config, name: "<script>saved</script>", entityType: "pipeline" });
      client.setQueryData(queryKeys.savedViews.list, [view]);
      const sidebar = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(SavedViewsSection)));
      assert.match(sidebar, /&lt;script&gt;saved&lt;\/script&gt;/);
      assert.ok(sidebar.includes(`/pipeline?view=${view.id}`));
      assert.match(sidebar, /Rename/); assert.match(sidebar, /Delete/);
      client.setQueryData(queryKeys.accounts.list, await db.accounts.toArray());
      client.setQueryData(queryKeys.deals.list, await db.deals.toArray());
      assert.match(render(createElement(PipelineWorkspace, { savedViewId: "missing" })), /saved view is no longer available/);
      assert.match(render(createElement(PipelineWorkspace, { savedViewId: view.id })), /value="  renewal  "/);
      await assert.rejects(client.fetchQuery({ queryKey: queryKeys.savedViews.list, queryFn: async () => { throw new Error("Unavailable"); }, staleTime: 0 }));
      assert.match(render(createElement(PipelineWorkspace, { savedViewId: view.id })), /Unable to load this saved view/);
    } finally { client.clear(); }
  });
});

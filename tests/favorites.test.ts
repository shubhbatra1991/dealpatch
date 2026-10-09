import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Dexie from "dexie";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Favorite, FavoriteTarget } from "../domain/favorites/favorite";
import { favoriteSchema } from "../domain/favorites/schema";
import { DealPatchDatabase } from "../lib/db/database";
import { DATABASE_VERSION, VERSION_2_STORES } from "../lib/db/schema";
import { resetWorkspace } from "../lib/db/workspace";
import { createFavoriteRepository } from "../lib/repositories/favorites";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { favoriteMutationOptions } from "../features/favorites/use-favorites";
import { resolveFavorites } from "../features/favorites/favorites-model";
import { FavoritesSection, FavoriteList } from "../features/favorites/favorites-section";
import { FavoriteButton } from "../features/favorites/favorite-button";

async function workspace(run: (db: DealPatchDatabase, repo: ReturnType<typeof createFavoriteRepository>) => Promise<void>) {
  const db = new DealPatchDatabase(`favorites-${randomUUID()}`);
  try { const repo = createFavoriteRepository(db); await repo.getAll(); await run(db, repo); }
  finally { await db.delete(); }
}

test("favorites persist account/contact/deal references without copied display data, remove and reset", async () => {
  await workspace(async (db, repo) => {
    const targets: FavoriteTarget[] = [
      { entityType: "account", entityId: (await db.accounts.toArray())[0].id },
      { entityType: "contact", entityId: (await db.contacts.toArray())[0].id },
      { entityType: "deal", entityId: (await db.deals.toArray())[0].id },
    ];
    for (const target of targets) {
      const favorite = (await repo.setFavorite(target, true))!;
      assert.deepEqual(Object.keys(favorite).sort(), ["createdAt", "entityId", "entityType", "id"]);
      assert.equal(favoriteSchema.safeParse(favorite).success, true);
    }
    db.close(); await db.open();
    assert.equal((await repo.getAll()).length, 3);
    await repo.setFavorite(targets[0], false);
    assert.equal((await repo.getAll()).length, 2);
    await repo.setFavorite(targets[0], false);
    assert.equal((await repo.getAll()).length, 2);
    await assert.rejects(repo.setFavorite({ entityType: "deal", entityId: "missing" }, true));
    await resetWorkspace(db);
    assert.deepEqual(await repo.getAll(), []);
  });
});

test("compound unique index and idempotent writes prevent duplicates across connections", async () => {
  await workspace(async (db, repo) => {
    const other = new DealPatchDatabase(db.name);
    try {
      const target: FavoriteTarget = { entityType: "account", entityId: (await db.accounts.toArray())[0].id };
      const second = createFavoriteRepository(other);
      const [first, duplicate] = await Promise.all([repo.setFavorite(target, true), second.setFavorite(target, true)]);
      assert.equal(first!.id, duplicate!.id);
      assert.equal((await repo.getAll()).length, 1);
      await assert.rejects(db.favorites.add({ ...first!, id: randomUUID() }));
    } finally { other.close(); }
  });
});

test("version 2 upgrades preserve records and audit history while adding empty favorites", async () => {
  const name = `favorites-upgrade-${randomUUID()}`;
  const old = new Dexie(name);
  old.version(2).stores(VERSION_2_STORES);
  await old.table("accounts").add({ id: "existing", name: "Locally edited" });
  await old.table("auditEvents").add({ id: "history", entityId: "existing" });
  old.close();
  const db = new DealPatchDatabase(name);
  try {
    await db.open();
    assert.equal(db.verno, DATABASE_VERSION);
    assert.equal((await db.accounts.get("existing"))!.name, "Locally edited");
    assert.equal(await db.auditEvents.count(), 1);
    assert.deepEqual(await createFavoriteRepository(db).getAll(), []);
  } finally { await db.delete(); }
});

test("missing references are non-navigable, removable, and names resolve live from entities", async () => {
  await workspace(async (db, repo) => {
    const account = (await db.accounts.toArray())[0];
    const favorite = (await repo.setFavorite({ entityType: "account", entityId: account.id }, true))!;
    assert.equal(resolveFavorites([favorite], [{ ...account, name: "Renamed locally" }], [], [])[0].name, "Renamed locally");
    await db.accounts.delete(account.id);
    const missing = resolveFavorites(await repo.getAll(), [], [], []);
    assert.equal(missing[0].href, undefined);
    assert.equal(missing[0].name, "Unavailable account");
    await repo.setFavorite({ entityType: favorite.entityType, entityId: favorite.entityId }, false);
    assert.deepEqual(await repo.getAll(), []);
  });
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

test("optimistic stars update the shared sidebar cache before persistence and rollback failures", async () => {
  await workspace(async (db, repo) => {
    const client = createQueryClient();
    const target: FavoriteTarget = { entityType: "account", entityId: (await db.accounts.toArray())[0].id };
    client.setQueryData(queryKeys.favorites.list, []);
    const started = deferred(), release = deferred();
    try {
      const mutation = client.getMutationCache().build(client, favoriteMutationOptions(client, target, {
        ...repo, setFavorite: async (record, enabled) => { started.resolve(); await release.promise; return repo.setFavorite(record, enabled); },
      }));
      const operation = mutation.execute(true);
      await started.promise;
      assert.equal(client.getQueryData<Favorite[]>(queryKeys.favorites.list)!.length, 1);
      assert.equal(await db.favorites.count(), 0);
      release.resolve(); await operation;
      assert.deepEqual(client.getQueryData(queryKeys.favorites.list), await repo.getAll());
      const failing = client.getMutationCache().build(client, favoriteMutationOptions(client, target, {
        ...repo, setFavorite: async () => { assert.deepEqual(client.getQueryData(queryKeys.favorites.list), []); throw new Error("Storage unavailable"); },
      }));
      await assert.rejects(failing.execute(false), /Storage unavailable/);
      assert.deepEqual(client.getQueryData(queryKeys.favorites.list), await repo.getAll());
      assert.match(renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(FavoritesSection))), /previous favorites were restored/);
      const remove = client.getMutationCache().build(client, favoriteMutationOptions(client, target, repo));
      await remove.execute(false);
      assert.deepEqual(client.getQueryData(queryKeys.favorites.list), []);
      assert.deepEqual(await repo.getAll(), []);
    } finally { client.clear(); }
  });
});

test("simultaneous different favorites retain each other when one write fails", async () => {
  await workspace(async (db, repo) => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.favorites.list, []);
    const accounts = await db.accounts.toArray();
    const started = deferred(), release = deferred();
    const first = { entityType: "account" as const, entityId: accounts[0].id };
    const second = { entityType: "account" as const, entityId: accounts[1].id };
    try {
      const failure = client.getMutationCache().build(client, favoriteMutationOptions(client, first, {
        ...repo, setFavorite: async () => { started.resolve(); await release.promise; throw new Error("Failed"); },
      }));
      const operation = failure.execute(true);
      const rejected = assert.rejects(operation, /Failed/);
      await started.promise;
      await client.getMutationCache().build(client, favoriteMutationOptions(client, second, repo)).execute(true);
      assert.equal(client.getQueryData<Favorite[]>(queryKeys.favorites.list)!.length, 2);
      release.resolve(); await rejected;
      assert.deepEqual(client.getQueryData<Favorite[]>(queryKeys.favorites.list)!.map(f => f.entityId), [second.entityId]);
    } finally { client.clear(); }
  });
});

test("sidebar renders five live records, all-favorites action, empty state, typed links and accessible stars", async () => {
  await workspace(async (db, repo) => {
    const client = createQueryClient();
    const accounts = await db.accounts.toArray(), contacts = await db.contacts.toArray(), deals = await db.deals.toArray();
    const render = (element: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement(QueryClientProvider, { client }, element));
    try {
      client.setQueryData(queryKeys.favorites.list, []);
      assert.match(render(createElement(FavoritesSection)), /No favorites yet/);
      assert.match(render(createElement(FavoriteButton, { entityType: "account", entityId: accounts[0].id })), /aria-label="Add to favorites".*aria-pressed="false"/);
      for (const account of accounts.slice(0, 6)) await repo.setFavorite({ entityType: "account", entityId: account.id }, true);
      const favorites = await repo.getAll();
      client.setQueryData(queryKeys.favorites.list, favorites);
      client.setQueryData(queryKeys.accounts.list, accounts);
      client.setQueryData(queryKeys.contacts.list, contacts);
      client.setQueryData(queryKeys.deals.list, deals);
      const html = render(createElement(FavoritesSection));
      assert.equal((html.match(/href="\/workspace\/accounts\//g) ?? []).length, 5);
      assert.match(html, /View all favorites/);
      assert.match(render(createElement(FavoriteButton, { entityType: "account", entityId: accounts[0].id })), /aria-label="Remove from favorites".*aria-pressed="true"/);
      const mixed: Favorite[] = [
        { id: "c", entityType: "contact", entityId: contacts[0].id, createdAt: new Date().toISOString() },
        { id: "d", entityType: "deal", entityId: deals[0].id, createdAt: new Date().toISOString() },
        { id: "gone", entityType: "account", entityId: "missing", createdAt: new Date().toISOString() },
      ];
      client.setQueryData(queryKeys.favorites.list, mixed);
      const list = render(createElement(FavoriteList, { records: resolveFavorites(mixed, accounts, contacts, deals), expanded: true }));
      assert.ok(list.includes(`/workspace/contacts/${contacts[0].id}`));
      assert.ok(list.includes(`/workspace/deals/${deals[0].id}`));
      assert.match(list, /Unavailable account/);
      assert.doesNotMatch(list, /href="\/workspace\/accounts\/missing"/);
      assert.equal((list.match(/aria-label="Remove .*? from favorites"/g) ?? []).length, 3);
    } finally { client.clear(); }
  });
});


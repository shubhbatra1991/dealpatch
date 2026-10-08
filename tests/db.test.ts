import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { DealPatchDatabase, getDatabase } from "../lib/db/database";
import { initializeWorkspace, resetWorkspace } from "../lib/db/workspace";

async function counts(database: DealPatchDatabase) {
  return Promise.all([database.accounts.count(), database.contacts.count(), database.deals.count(), database.activities.count(), database.proposals.count()]);
}

// Counts are explicitly ordered: accounts, contacts, deals, activities, proposals.
const seedCounts = [30, 80, 60, 150, 15];

test("SSR imports and initialization do not create a browser database", async () => {
  assert.throws(() => getDatabase(), /requires IndexedDB in a browser/);
  await assert.rejects(initializeWorkspace(), /requires IndexedDB in a browser/);
  assert.equal((await indexedDB.databases()).some((database) => database.name === "dealpatch"), false);
});

test("first load seeds once; edits survive reinitialization and reopening", async () => {
  const name = `dealpatch-test-${randomUUID()}`;
  const database = new DealPatchDatabase(name);
  try {
    await initializeWorkspace(database);
    assert.deepEqual(await counts(database), seedCounts);
    const deal = (await database.deals.toArray())[0];
    await database.deals.update(deal.id, { title: "Edited opportunity", value: 91234 });
    database.close();
    const reopened = new DealPatchDatabase(name);
    try {
      await initializeWorkspace(reopened);
      await initializeWorkspace(reopened);
      assert.equal((await reopened.deals.get(deal.id))?.title, "Edited opportunity");
      assert.equal((await reopened.deals.get(deal.id))?.value, 91234);
      assert.deepEqual(await counts(reopened), seedCounts);
    } finally { reopened.close(); }
  } finally { await database.delete(); }
});

test("concurrent connections cannot double seed", async () => {
  const database = new DealPatchDatabase(`dealpatch-test-${randomUUID()}`);
  const other = new DealPatchDatabase(database.name);
  try {
    await Promise.all([initializeWorkspace(database), initializeWorkspace(other), initializeWorkspace(database)]);
    assert.deepEqual(await counts(database), seedCounts);
  } finally { other.close(); await database.delete(); }
});

test("a partially populated workspace is preserved rather than backfilled", async () => {
  const database = new DealPatchDatabase(`dealpatch-test-${randomUUID()}`);
  try {
    await database.accounts.add({ id: "custom", name: "Locally edited account", ownerId: "demo", status: "Active", createdAt: "2026-10-08T09:00:00.000Z", updatedAt: "2026-10-08T09:00:00.000Z" });
    await initializeWorkspace(database);
    assert.deepEqual(await counts(database), [1, 0, 0, 0, 0]);
    assert.equal((await database.accounts.get("custom"))?.name, "Locally edited account");
  } finally { await database.delete(); }
});

test("failed seeding rolls back all stores and can be retried", async () => {
  const database = new DealPatchDatabase(`dealpatch-test-${randomUUID()}`);
  const fail = () => { throw new Error("Simulated storage write failure"); };
  try {
    database.proposals.hook("creating", fail);
    await assert.rejects(initializeWorkspace(database), /Simulated storage write failure/);
    assert.deepEqual(await counts(database), [0, 0, 0, 0, 0]);
    database.proposals.hook("creating").unsubscribe(fail);
    await initializeWorkspace(database);
    assert.deepEqual(await counts(database), seedCounts);
  } finally { await database.delete(); }
});

test("reset restores edits and deleted records; a failed reset preserves local data", async () => {
  const database = new DealPatchDatabase(`dealpatch-test-${randomUUID()}`);
  const fail = () => { throw new Error("Simulated reset failure"); };
  try {
    await initializeWorkspace(database);
    const original = await database.accounts.toArray();
    await database.accounts.update(original[0].id, { name: "Local edit" });
    await database.contacts.clear();
    database.proposals.hook("creating", fail);
    await assert.rejects(resetWorkspace(database), /Simulated reset failure/);
    assert.equal((await database.accounts.get(original[0].id))?.name, "Local edit");
    assert.equal(await database.contacts.count(), 0);
    database.proposals.hook("creating").unsubscribe(fail);
    await resetWorkspace(database);
    assert.deepEqual(await database.accounts.toArray(), original);
    assert.deepEqual(await counts(database), seedCounts);
    await initializeWorkspace(database);
    assert.deepEqual(await counts(database), seedCounts);
  } finally { await database.delete(); }
});


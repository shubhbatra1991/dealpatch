import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { DealPatchDatabase } from "../lib/db/database";
import { createAccountRepository, accountRepository } from "../lib/repositories/accounts";
import { createDealRepository, dealRepository } from "../lib/repositories/deals";
import { createProposalRepository, proposalRepository } from "../lib/repositories/proposals";

async function withWorkspace(run: (database: DealPatchDatabase) => Promise<void>) {
  const database = new DealPatchDatabase(`dealpatch-repositories-test-${randomUUID()}`);
  try { await run(database); } finally { await database.delete(); }
}

test("shared repositories are lazy and reject server-side calls", async () => {
  await assert.rejects(accountRepository.getAll(), /requires IndexedDB in a browser/);
  await assert.rejects(dealRepository.getAll(), /requires IndexedDB in a browser/);
  await assert.rejects(proposalRepository.getPending(), /requires IndexedDB in a browser/);
  assert.equal((await indexedDB.databases()).some((database) => database.name === "dealpatch"), false);
});

test("reads initialize once and return detached domain records", async () => {
  await withWorkspace(async (database) => {
    const accounts = createAccountRepository(database);
    const deals = createDealRepository(database);
    const records = await accounts.getAll();
    assert.equal(records.length, 30);
    assert.equal((await deals.getAll()).length, 60);
    const original = await accounts.getById(records[0].id);
    assert.deepEqual(original, records[0]);
    records[0].name = "Unpersisted local change";
    assert.deepEqual(await accounts.getById(records[0].id), original);
    assert.equal(await accounts.getById("missing"), undefined);
    assert.equal(await deals.getById("missing"), undefined);
    assert.equal(await createProposalRepository(database).getById("missing"), undefined);
  });
});

test("deal patches preserve other fields and concurrent writes", async () => {
  await withWorkspace(async (database) => {
    const repository = createDealRepository(database);
    const original = (await repository.getAll())[0];
    const updated = await repository.update(original.id, { title: "Updated opportunity", value: 90000 });
    assert.deepEqual(updated, { ...original, title: "Updated opportunity", value: 90000 });
    await Promise.all([
      repository.update(original.id, { probability: 55 }),
      repository.update(original.id, { nextStep: "Arrange a technical review." }),
    ]);
    const saved = await repository.getById(original.id);
    assert.equal(saved?.probability, 55);
    assert.equal(saved?.nextStep, "Arrange a technical review.");
    assert.equal(saved?.value, 90000);
    await repository.update(original.id, { expectedCloseDate: undefined });
    assert.equal((await repository.getById(original.id))?.expectedCloseDate, undefined);
  });
});

test("invalid deal mutations and missing records do not write data", async () => {
  await withWorkspace(async (database) => {
    const repository = createDealRepository(database);
    const original = (await repository.getAll())[0];
    await assert.rejects(repository.update(original.id, { probability: 101 }));
    await assert.rejects(repository.update(original.id, { value: -10 }));
    // @ts-expect-error Identity must also be rejected at the runtime boundary.
    await assert.rejects(repository.update(original.id, { id: "replacement" }));
    // @ts-expect-error Account membership cannot be patched.
    await assert.rejects(repository.update(original.id, { accountId: "missing" }));
    await assert.rejects(repository.update("missing", { title: "No record" }), /was not found/);
    assert.deepEqual(await repository.getById(original.id), original);
    assert.equal((await repository.getAll()).length, 60);
  });
});

test("proposal edits preserve metadata and do not apply changes to deals", async () => {
  await withWorkspace(async (database) => {
    const repository = createProposalRepository(database);
    const pending = await repository.getPending();
    assert.equal(pending.length, 15);
    assert.deepEqual(pending.map((proposal) => proposal.createdAt), pending.map((proposal) => proposal.createdAt).sort());
    const original = pending[0];
    const dealBefore = await database.deals.get(original.dealId!);
    const changes = original.changes.map((change) => ({ ...change, selected: false }));
    await Promise.all([
      repository.updateChanges(original.id, changes),
      repository.updateStatus(original.id, "Rejected"),
    ]);
    assert.deepEqual(await repository.getById(original.id), { ...original, changes, status: "Rejected" });
    assert.equal((await repository.getPending()).length, 14);
    assert.deepEqual(await database.deals.get(original.dealId!), dealBefore);
    await assert.rejects(repository.updateStatus("missing", "Rejected"), /was not found/);
    await assert.rejects(repository.updateChanges("missing", changes), /was not found/);
  });
});

test("invalid proposal writes leave the stored record intact", async () => {
  await withWorkspace(async (database) => {
    const repository = createProposalRepository(database);
    const original = (await repository.getPending())[0];
    await assert.rejects(repository.updateChanges(original.id, []));
    // @ts-expect-error Invalid statuses must also fail runtime validation.
    await assert.rejects(repository.updateStatus(original.id, "Done"));
    // @ts-expect-error Invalid fields must also fail runtime validation.
    await assert.rejects(repository.updateChanges(original.id, [{ ...original.changes[0], field: "id" }]));
    assert.deepEqual(await repository.getById(original.id), original);
  });
});

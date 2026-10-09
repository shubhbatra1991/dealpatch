import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { QueryObserver } from "@tanstack/react-query";
import type { Proposal } from "../domain/proposals/proposal";
import { DealPatchDatabase } from "../lib/db/database";
import { loadSeedData } from "../lib/db/seed";
import { createProposalRepository } from "../lib/repositories/proposals";
import { createReviewRepository, type ReviewItem } from "../lib/repositories/reviews";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { createMockIntelligenceProvider } from "../lib/simulation/mock-intelligence-provider";
import { queueProposalOptions } from "../features/activity/queue-proposal";

const seed = loadSeedData();
async function setup() {
  const db = new DealPatchDatabase(`activity-flow-${randomUUID()}`);
  const repository = createProposalRepository(db);
  await repository.getAll();
  const activity = { ...seed.activities.find(item => item.id === "activity_003")!, id: randomUUID() };
  await db.activities.add(activity);
  const provider = createMockIntelligenceProvider({ stepDelayMs: 0 });
  let proposal: Proposal | undefined;
  for await (const event of provider.analyze({ activity, accounts: seed.accounts, deals: seed.deals })) {
    if (event.type === "proposal_generated") proposal = event.proposal;
  }
  assert.ok(proposal);
  return { db, repository, proposal };
}

test("explicit send publishes the review, account history and sidebar count without applying CRM values", async () => {
  const { db, repository, proposal } = await setup();
  const client = createQueryClient();
  const observer = new QueryObserver<Proposal[]>(client, { queryKey: queryKeys.proposals.pending, enabled: false });
  const counts: number[] = [];
  const unsubscribe = observer.subscribe(result => { if (result.data) counts.push(result.data.length); });
  try {
    const before = await db.deals.toArray();
    client.setQueryData(queryKeys.proposals.pending, await repository.getPending());
    client.setQueryData(queryKeys.proposals.list, await repository.getAll());
    client.setQueryData(queryKeys.proposals.forAccount(proposal.accountId), await repository.getByAccountId(proposal.accountId));
    client.setQueryData(queryKeys.proposals.queue, await createReviewRepository(db).getQueue());
    client.setQueryData(queryKeys.accounts.list, seed.accounts);
    client.setQueryData(queryKeys.activities.list, await db.activities.toArray());
    client.setQueryData(queryKeys.deals.list, before);
    assert.equal((await repository.getAll()).length, 15, "analysis alone must not persist");
    const mutation = client.getMutationCache().build(client, queueProposalOptions(client, repository));
    const result = await mutation.execute(proposal);
    assert.equal(result.created, true);
    assert.equal(counts.at(-1), 16, "the sidebar's shared pending query updates immediately");
    const item = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.find(item => item.proposal.id === result.proposal.id)!;
    assert.equal(item.account, seed.accounts.find(item => item.id === proposal.accountId)!.name);
    assert.equal(item.source?.summary, seed.activities.find(item => item.id === "activity_003")!.summary);
    assert.ok(item.changes.every(change => change.current === change.change.before && !change.conflict));
    assert.ok(client.getQueryData<Proposal[]>(queryKeys.proposals.forAccount(proposal.accountId))!.some(item => item.id === proposal.id));
    await client.getMutationCache().build(client, queueProposalOptions(client, repository)).execute(proposal);
    assert.equal(counts.at(-1), 16);
    assert.deepEqual(await db.deals.toArray(), before);
  } finally { unsubscribe(); client.clear(); await db.delete(); }
});

test("send failure preserves caches and releases the review write lock for retry", async () => {
  const { db, repository, proposal } = await setup();
  const client = createQueryClient();
  try {
    client.setQueryData(queryKeys.proposals.pending, await repository.getPending());
    const mutation = client.getMutationCache().build(client, queueProposalOptions(client, { queueGenerated: async () => { throw new Error("Storage unavailable"); } }));
    await assert.rejects(mutation.execute(proposal), /Storage unavailable/);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 15);
    assert.equal((await repository.getAll()).length, 15);
    assert.equal((await client.getMutationCache().build(client, queueProposalOptions(client, repository)).execute(proposal)).created, true);
  } finally { client.clear(); await db.delete(); }
});

test("one source activity cannot create duplicates after edits, rejection, approval or simultaneous sends", async () => {
  const { db, repository, proposal } = await setup();
  try {
    const peer = new DealPatchDatabase(db.name);
    try {
      const results = await Promise.all([repository.queueGenerated(proposal), createProposalRepository(peer).queueGenerated({ ...proposal, id: randomUUID() })]);
      assert.equal(results.filter(result => result.created).length, 1);
      assert.equal(results[0].proposal.id, results[1].proposal.id);
      for (const status of ["Pending", "PartiallyApproved", "Approved", "Rejected"] as const) {
        await db.proposals.put({ ...results[0].proposal, status });
        const different = { ...proposal, id: randomUUID(), changes: proposal.changes.map(change => ({ ...change, after: change.after === "Evaluation" ? "Proposal" : change.after })) } as Proposal;
        const duplicate = await repository.queueGenerated(different);
        assert.equal(duplicate.created, false);
        assert.equal(duplicate.proposal.status, status);
      }
      assert.equal(await db.proposals.where("sourceActivityId").equals(proposal.sourceActivityId).count(), 1);
    } finally { peer.close(); }
  } finally { await db.delete(); }
});

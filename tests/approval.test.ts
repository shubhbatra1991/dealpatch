import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Deal } from "../domain/deals/deal";
import type { Contact } from "../domain/contacts/contact";
import type { Proposal } from "../domain/proposals/proposal";
import { DealPatchDatabase } from "../lib/db/database";
import { createReviewRepository, type ReviewItem } from "../lib/repositories/reviews";
import { createProposalRepository } from "../lib/repositories/proposals";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { approvalMutationOptions, undoMutationOptions } from "../features/reviews/approval-mutations";
import { ReviewNotifications } from "../features/reviews/review-notifications";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function workspace(run: (environment: {
  db: DealPatchDatabase; repo: ReturnType<typeof createReviewRepository>;
  client: ReturnType<typeof createQueryClient>; item: ReviewItem;
}) => Promise<void>) {
  const db = new DealPatchDatabase(`approval-test-${randomUUID()}`);
  const client = createQueryClient();
  try {
    const repo = createReviewRepository(db);
    const queue = await repo.getQueue();
    client.setQueryData(queryKeys.proposals.queue, queue);
    client.setQueryData(queryKeys.proposals.pending, await createProposalRepository(db).getPending());
    client.setQueryData(queryKeys.deals.list, await db.deals.toArray());
    client.setQueryData(queryKeys.accounts.list, await db.accounts.toArray());
    client.setQueryData(queryKeys.contacts.list, await db.contacts.toArray());
    client.setQueryData(queryKeys.proposals.list, await db.proposals.toArray());
    await run({ db, repo, client, item: queue[0] });
  } finally { client.clear(); await db.delete(); }
}

test("successful approval updates deal, queue and count before persistence completes", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const started = deferred(), release = deferred();
    const before = await db.deals.get(item.proposal.dealId!);
    const mutation = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async (id, ids) => { started.resolve(); await release.promise; return repo.approve(id, ids); },
    }));
    const operation = mutation.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(c => c.id) });
    await started.promise;
    assert.equal(mutation.state.status, "pending");
    assert.equal(mutation.state.context?.receipt.after.status, "Approved");
    const visible = client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(deal => deal.id === before!.id)!;
    assert.equal(visible.stage, "Evaluation");
    assert.equal(visible.probability, 45);
    assert.deepEqual(await db.deals.get(before!.id), before);
    assert.equal(client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.length, 14);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 14);
    release.resolve();
    const receipt = await operation;
    assert.equal(receipt.after.status, "Approved");
    assert.equal((await db.deals.get(before!.id))!.stage, visible.stage);
    assert.equal((await db.proposals.get(item.proposal.id))!.status, "Approved");
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.list)!.find(proposal => proposal.id === item.proposal.id)!.status, "Approved");
    assert.equal(mutation.state.status, "success");
  });
});

test("partial optimistic approval leaves unselected fields and pending count intact", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const started = deferred(), release = deferred();
    const mutation = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async (id, ids) => { started.resolve(); await release.promise; return repo.approve(id, ids); },
    }));
    const operation = mutation.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: [item.proposal.changes[0].id] });
    await started.promise;
    const visible = client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(deal => deal.id === item.proposal.dealId)!;
    assert.equal(visible.stage, "Evaluation");
    assert.equal(visible.probability, 20);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 15);
    const pending = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.find(row => row.proposal.id === item.proposal.id)!;
    assert.equal(pending.proposal.status, "PartiallyApproved");
    assert.equal(pending.changes[1].change.status, "Pending");
    release.resolve();
    await operation;
    assert.equal((await db.deals.get(visible.id))!.probability, 20);
  });
});

test("failed persistence rolls back proposal and affected fields without losing unrelated cache changes", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const started = deferred(), release = deferred();
    const before = client.getQueryData<Deal[]>(queryKeys.deals.list)!;
    const mutation = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async () => { started.resolve(); await release.promise; throw new Error("IndexedDB write failed"); },
    }));
    const operation = mutation.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(c => c.id) });
    const rejected = assert.rejects(operation, /IndexedDB write failed/);
    await started.promise;
    client.setQueryData<Deal[]>(queryKeys.deals.list, rows => rows!.map(row => row.id === item.proposal.dealId ? { ...row, nextStep: "Unrelated cached edit" } : row));
    release.resolve();
    await rejected;
    const restored = client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(row => row.id === item.proposal.dealId)!;
    assert.deepEqual(restored, { ...before.find(row => row.id === restored.id), nextStep: "Unrelated cached edit" });
    assert.deepEqual(client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.find(row => row.proposal.id === item.proposal.id), item);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 15);
    assert.deepEqual(await db.proposals.get(item.proposal.id), item.proposal);
    assert.equal(mutation.state.status, "error");
    assert.deepEqual(client.getQueryData<Proposal[]>(queryKeys.proposals.list)!.find(proposal => proposal.id === item.proposal.id), item.proposal);
  });
});

test("full Undo restores original CRM fields, proposal and caches while preserving later unrelated edits", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const before = (await db.deals.get(item.proposal.dealId!))!;
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    const receipt = await approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(c => c.id) });
    await db.deals.update(before.id, { nextStep: "A newer unrelated next step" });
    client.setQueryData(queryKeys.deals.list, await db.deals.toArray());
    const undo = client.getMutationCache().build(client, undoMutationOptions(client, repo));
    await undo.execute({ receipt, item, approvalId: approval.mutationId });
    const expected = { ...before, nextStep: "A newer unrelated next step" };
    assert.deepEqual(await db.deals.get(before.id), expected);
    assert.deepEqual(client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(row => row.id === before.id), expected);
    assert.deepEqual(await db.proposals.get(item.proposal.id), item.proposal);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 15);
    assert.deepEqual(client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.find(row => row.proposal.id === item.proposal.id)!.proposal, item.proposal);
  });
});

test("partial Undo preserves earlier approvals and restores edited proposal state exactly", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const [stage, probability] = item.proposal.changes;
    await repo.approve(item.proposal.id, [stage.id]);
    await repo.review(item.proposal.id, { type: "edit", changeId: probability.id, value: 55 });
    const partial = (await repo.getQueue()).find(row => row.proposal.id === item.proposal.id)!;
    client.setQueryData(queryKeys.proposals.queue, await repo.getQueue());
    client.setQueryData(queryKeys.proposals.pending, await createProposalRepository(db).getPending());
    client.setQueryData(queryKeys.deals.list, await db.deals.toArray());
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    const receipt = await approval.execute({ id: item.proposal.id, expectedProposal: partial.proposal, changeIds: [probability.id] });
    await client.getMutationCache().build(client, undoMutationOptions(client, repo)).execute({ receipt, item: partial, approvalId: approval.mutationId });
    assert.deepEqual(await db.proposals.get(item.proposal.id), partial.proposal);
    const deal = (await db.deals.get(item.proposal.dealId!))!;
    assert.equal(deal.stage, "Evaluation");
    assert.equal(deal.probability, 20);
    assert.equal((await db.proposals.get(item.proposal.id))!.changes[1].after, 55);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 15);
  });
});

test("failed Undo rolls back its optimistic restoration and can be retried", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    const receipt = await approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(c => c.id) });
    const started = deferred(), release = deferred();
    const undo = client.getMutationCache().build(client, undoMutationOptions(client, {
      ...repo, undo: async () => { started.resolve(); await release.promise; throw new Error("Undo storage failure"); },
    }));
    const operation = undo.execute({ receipt, item, approvalId: approval.mutationId });
    const rejected = assert.rejects(operation, /Undo storage failure/);
    await started.promise;
    assert.equal(client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(row => row.id === item.proposal.dealId)!.stage, "Discovery");
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 15);
    release.resolve();
    await rejected;
    assert.equal(client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(row => row.id === item.proposal.dealId)!.stage, "Evaluation");
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 14);
    assert.deepEqual(await db.proposals.get(item.proposal.id), receipt.after);
    await client.getMutationCache().build(client, undoMutationOptions(client, repo)).execute({ receipt, item, approvalId: approval.mutationId });
    assert.deepEqual(await db.proposals.get(item.proposal.id), receipt.before);
  });
});

test("Undo refuses newer changes and overlapping optimistic writes are blocked", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const started = deferred(), release = deferred();
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async (id, ids) => { started.resolve(); await release.promise; return repo.approve(id, ids); },
    }));
    const operation = approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(c => c.id) });
    await started.promise;
    const second = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)![0];
    await assert.rejects(client.getMutationCache().build(client, approvalMutationOptions(client, repo)).execute({ id: second.proposal.id, expectedProposal: second.proposal, changeIds: second.proposal.changes.map(c => c.id) }), /Another review/);
    release.resolve();
    const receipt = await operation;
    await db.deals.update(item.proposal.dealId!, { probability: 80 });
    await assert.rejects(repo.undo(receipt), /changed later/);
    assert.equal((await db.deals.get(item.proposal.dealId!))!.stage, "Evaluation");
    assert.equal((await db.deals.get(item.proposal.dealId!))!.probability, 80);
    assert.deepEqual(await db.proposals.get(item.proposal.id), receipt.after);
  });
});

test("sequential partial approvals must be undone in reverse order", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const first = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    const firstReceipt = await first.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: [item.proposal.changes[0].id] });
    const partial = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.find(row => row.proposal.id === item.proposal.id)!;
    const second = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    const secondReceipt = await second.execute({ id: item.proposal.id, expectedProposal: partial.proposal, changeIds: [item.proposal.changes[1].id] });
    await assert.rejects(client.getMutationCache().build(client, undoMutationOptions(client, repo)).execute({ receipt: firstReceipt, item, approvalId: first.mutationId }), /most recent approval/);
    assert.deepEqual(await db.proposals.get(item.proposal.id), secondReceipt.after);
    await client.getMutationCache().build(client, undoMutationOptions(client, repo)).execute({ receipt: secondReceipt, item: partial, approvalId: second.mutationId });
    await client.getMutationCache().build(client, undoMutationOptions(client, repo)).execute({ receipt: firstReceipt, item, approvalId: first.mutationId });
    assert.deepEqual(await db.proposals.get(item.proposal.id), item.proposal);
    assert.equal((await db.deals.get(item.proposal.dealId!))!.stage, "Discovery");
  });
});

test("global success and rollback notifications render after approval leaves the queue", async () => {
  await workspace(async ({ repo, client, item }) => {
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    await approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(c => c.id) });
    const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ReviewNotifications)));
    let html = render();
    assert.ok(html.includes("Approved 2 changes for Avelmere Systems"));
    assert.ok(html.includes(">Undo</button>"));
    assert.ok(html.includes('role="status"'));
    const next = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)![0];
    await assert.rejects(client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async () => { throw new Error("Storage unavailable"); },
    })).execute({ id: next.proposal.id, expectedProposal: next.proposal, changeIds: next.proposal.changes.map(c => c.id) }));
    html = render();
    assert.ok(html.includes("Previous values and the proposal were restored"));
    assert.ok(html.includes("Storage unavailable"));
    assert.ok(html.includes('role="alert"'));
  });
});

test("contact approval patches list, account contacts and proposal history optimistically, then rollback and undo restore them", async () => {
  await workspace(async ({ db, repo, client }) => {
    const item = (await repo.getQueue()).find(row => row.proposal.changes.some(change => change.entityType === "Contact"))!;
    const change = item.proposal.changes[0];
    const before = await db.contacts.get(change.entityId);
    const contactsKey = queryKeys.contacts.forAccount(item.proposal.accountId);
    const proposalsKey = queryKeys.proposals.forAccount(item.proposal.accountId);
    client.setQueryData(contactsKey, await db.contacts.where("accountId").equals(item.proposal.accountId).toArray());
    client.setQueryData(proposalsKey, await db.proposals.where("accountId").equals(item.proposal.accountId).toArray());
    const started = deferred(), release = deferred();
    const failed = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async () => { started.resolve(); await release.promise; throw new Error("Contact storage failure"); },
    }));
    const rejected = assert.rejects(failed.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: [change.id] }), /Contact storage failure/);
    await started.promise;
    for (const key of [queryKeys.contacts.list, contactsKey]) assert.equal(Reflect.get(client.getQueryData<Contact[]>(key)!.find(contact => contact.id === change.entityId)!, change.field), change.after);
    for (const key of [queryKeys.proposals.list, proposalsKey]) assert.equal(client.getQueryData<Proposal[]>(key)!.find(proposal => proposal.id === item.proposal.id)!.status, "PartiallyApproved");
    assert.deepEqual(await db.contacts.get(change.entityId), before);
    release.resolve(); await rejected;
    for (const key of [queryKeys.contacts.list, contactsKey]) assert.deepEqual(client.getQueryData<Contact[]>(key)!.find(contact => contact.id === change.entityId), before);
    for (const key of [queryKeys.proposals.list, proposalsKey]) assert.deepEqual(client.getQueryData<Proposal[]>(key)!.find(proposal => proposal.id === item.proposal.id), item.proposal);
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, repo));
    const receipt = await approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: [change.id] });
    assert.equal((await db.contacts.get(change.entityId))!.role, change.after);
    await client.getMutationCache().build(client, undoMutationOptions(client, repo)).execute({ receipt, item, approvalId: approval.mutationId });
    for (const key of [queryKeys.contacts.list, contactsKey]) assert.deepEqual(client.getQueryData<Contact[]>(key)!.find(contact => contact.id === change.entityId), before);
    for (const key of [queryKeys.proposals.list, proposalsKey]) assert.deepEqual(client.getQueryData<Proposal[]>(key)!.find(proposal => proposal.id === item.proposal.id), item.proposal);
  });
});

test("a proposal edited in another view after optimistic approval begins cannot apply unseen values", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const started = deferred(), release = deferred();
    const original = await db.deals.get(item.proposal.dealId!);
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async (id, ids, expected) => { started.resolve(); await release.promise; return repo.approve(id, ids, expected); },
    }));
    const rejected = assert.rejects(approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(change => change.id) }), /edited or reviewed/);
    await started.promise;
    const edited = await repo.review(item.proposal.id, { type: "edit", changeId: item.proposal.changes[1].id, value: 75 });
    release.resolve(); await rejected;
    assert.deepEqual(await db.deals.get(item.proposal.dealId!), original);
    assert.deepEqual(await db.proposals.get(item.proposal.id), edited);
    assert.deepEqual(client.getQueryData<Deal[]>(queryKeys.deals.list)!.find(deal => deal.id === original!.id), original);
    assert.equal((await db.auditEvents.toArray()).filter(event => event.action !== "FieldEdited").length, 0);
  });
});

test("a newly stale persisted value rolls back optimistic approval and refetches the conflict for review", async () => {
  await workspace(async ({ db, repo, client, item }) => {
    const started = deferred(), release = deferred();
    const approval = client.getMutationCache().build(client, approvalMutationOptions(client, {
      ...repo, approve: async (id, ids, expected) => { started.resolve(); await release.promise; return repo.approve(id, ids, expected); },
    }));
    const rejected = assert.rejects(approval.execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: item.proposal.changes.map(change => change.id) }), /current value changed/);
    await started.promise;
    await db.deals.update(item.proposal.dealId!, { probability: 38 });
    release.resolve(); await rejected;
    assert.equal((await db.deals.get(item.proposal.dealId!))!.stage, "Discovery");
    assert.equal((await db.deals.get(item.proposal.dealId!))!.probability, 38);
    assert.deepEqual(await db.proposals.get(item.proposal.id), item.proposal);
    assert.equal(await db.auditEvents.count(), 0);
    assert.equal(client.getQueryState(queryKeys.proposals.queue)?.isInvalidated, true);
    const refreshed = await client.fetchQuery({ queryKey: queryKeys.proposals.queue, queryFn: () => repo.getQueue() });
    const stale = refreshed.find(row => row.proposal.id === item.proposal.id)!;
    assert.equal(stale.changes[1].current, 38); assert.equal(stale.changes[1].conflict, true);
    await assert.rejects(client.getMutationCache().build(client, approvalMutationOptions(client, repo)).execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: [item.proposal.changes[1].id] }), /conflict/);
  });
});

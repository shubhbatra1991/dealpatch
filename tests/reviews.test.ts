import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderWithKeyboard as renderToStaticMarkup } from "./keyboard-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { DealPatchDatabase } from "../lib/db/database";
import { createReviewRepository } from "../lib/repositories/reviews";
import { createProposalRepository } from "../lib/repositories/proposals";
import { createQueryClient } from "../lib/query/client";
import { ReviewCard } from "../features/reviews/review-card";
import { ReviewWorkspace } from "../features/reviews/review-workspace";
import { reviewQueueOptions } from "../features/reviews/use-review-queue";
import { parseEdit } from "../features/reviews/review-format";
import { ReviewOutcome } from "../features/reviews/review-outcome";
import { ReviewHistory } from "../features/reviews/review-history";
import { queryKeys } from "../lib/query/keys";

async function workspace(run: (db: DealPatchDatabase, repo: ReturnType<typeof createReviewRepository>) => Promise<void>) {
  const db = new DealPatchDatabase(`review-test-${randomUUID()}`);
  try { await run(db, createReviewRepository(db)); } finally { await db.delete(); }
}

test("HTML-like account names, source text and evidence render as escaped text", async () => {
  await workspace(async (_db, repo) => {
    const item = (await repo.getQueue())[0];
    const payload = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
    item.account = payload;
    item.source!.summary = payload;
    item.proposal.evidence[0].text = payload;
    const client = createQueryClient();
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ReviewCard, { item, onReviewed: () => {}, active: true, onActivate: () => {} })));
      assert.ok(html.includes("&lt;img"));
      assert.ok(html.includes("&lt;script&gt;"));
      assert.ok(!html.includes("<img"));
      assert.ok(!html.includes("<script"));
    } finally { client.clear(); }
  });
});

test("queue joins source, account, targets and live current values", async () => {
  await workspace(async (db, repo) => {
    const queue = await repo.getQueue();
    assert.equal(queue.length, 15);
    assert.ok(queue.every(item => item.account !== "Missing account" && item.source && item.deal));
    assert.ok(queue.every(item => item.changes.every(change => !change.conflict)));
    assert.deepEqual(queue.map(item => item.proposal.createdAt), queue.map(item => item.proposal.createdAt).sort());
    const first = queue[0];
    await db.deals.update(first.proposal.dealId!, { stage: "Negotiation" });
    assert.equal((await repo.getQueue())[0].changes[0].current, "Negotiation");
    assert.equal((await repo.getQueue())[0].changes[0].conflict, true);
  });
});

test("partial approval applies exactly selected fields and remaining changes stay reviewable", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    const before = (await db.deals.get(item.proposal.dealId!))!;
    const first = item.proposal.changes[0];
    const result = await repo.review(item.proposal.id, { type: "approve", changeIds: [first.id] });
    assert.equal(result.status, "PartiallyApproved");
    assert.deepEqual(await db.deals.get(before.id), { ...before, [first.field]: first.after });
    assert.equal(result.changes[1].status, "Pending");
    assert.equal((await repo.getQueue()).length, 15);
    assert.equal((await createProposalRepository(db).getPending()).length, 15);
    await repo.review(item.proposal.id, { type: "reject" });
    assert.equal((await repo.getQueue()).length, 14);
    assert.equal((await createProposalRepository(db).getPending()).length, 14);
    assert.equal((await db.proposals.get(result.id))!.changes[0].status, "Approved");
    assert.deepEqual(await db.deals.get(before.id), { ...before, [first.field]: first.after });
  });
});

test("approval is atomic when a later field is stale; invalid and duplicate selections do not write", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    await db.deals.update(item.proposal.dealId!, { probability: 30 });
    const before = await db.deals.get(item.proposal.dealId!);
    await assert.rejects(repo.review(item.proposal.id, { type: "approve", changeIds: item.proposal.changes.map(c => c.id) }), /current value changed/);
    assert.deepEqual(await db.deals.get(item.proposal.dealId!), before);
    assert.deepEqual(await db.proposals.get(item.proposal.id), item.proposal);
    for (const ids of [[], ["missing"], [item.proposal.changes[0].id, item.proposal.changes[0].id]]) {
      await assert.rejects(repo.review(item.proposal.id, { type: "approve", changeIds: ids }), /Select pending/);
    }
  });
});

test("edit validates values, saves suggestions only, and approval persists contact changes", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue()).find(item => item.proposal.id === "proposal_015")!;
    const [role, email] = item.proposal.changes;
    const before = (await db.contacts.get(role.entityId))!;
    await assert.rejects(repo.review(item.proposal.id, { type: "edit", changeId: email.id, value: "invalid" }));
    await repo.review(item.proposal.id, { type: "edit", changeId: role.id, value: "Revenue Systems Director" });
    assert.deepEqual(await db.contacts.get(role.entityId), before);
    const result = await repo.review(item.proposal.id, { type: "approve", changeIds: [role.id, email.id] });
    assert.equal(result.status, "Approved");
    assert.deepEqual(await db.contacts.get(role.entityId), { ...before, role: "Revenue Systems Director", email: email.after });
    assert.equal((await repo.getQueue()).some(item => item.proposal.id === result.id), false);
    await assert.rejects(repo.review(result.id, { type: "approve", changeIds: [role.id] }), /already been reviewed/);
    const reopened = new DealPatchDatabase(db.name);
    try { assert.equal((await reopened.contacts.get(role.entityId))?.role, "Revenue Systems Director"); } finally { reopened.close(); }
  });
});

test("reject never mutates CRM records; concurrent duplicate approvals apply only once", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    const before = await db.deals.toArray();
    await repo.review(item.proposal.id, { type: "reject" });
    assert.deepEqual(await db.deals.toArray(), before);
    const second = (await repo.getQueue())[0];
    const action = { type: "approve" as const, changeIds: second.proposal.changes.map(c => c.id) };
    const results = await Promise.allSettled([repo.review(second.proposal.id, action), repo.review(second.proposal.id, action)]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  });
});

test("missing and foreign target records cannot be approved", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    await db.deals.update(item.proposal.dealId!, { accountId: "account_030" });
    await assert.rejects(repo.review(item.proposal.id, { type: "approve", changeIds: item.proposal.changes.map(c => c.id) }), /another account/);
    await db.deals.delete(item.proposal.dealId!);
    assert.equal((await repo.getQueue())[0].changes[0].conflict, true);
    await repo.review(item.proposal.id, { type: "reject" });
  });
});

test("ambiguous change identifiers cannot apply extra fields", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    const before = await db.deals.get(item.proposal.dealId!);
    const changes = item.proposal.changes.map(change => ({ ...change, id: "duplicate" }));
    await db.proposals.update(item.proposal.id, { changes });
    await assert.rejects(repo.review(item.proposal.id, { type: "approve", changeIds: ["duplicate"] }), /duplicate change identifiers/);
    assert.deepEqual(await db.deals.get(item.proposal.dealId!), before);
  });
});

test("review cards render semantic diffs, evidence, selection and explicit actions", async () => {
  await workspace(async (_db, repo) => {
    const item = (await repo.getQueue())[0];
    const client = createQueryClient();
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ReviewCard, { item, onReviewed: () => {}, active: true, onActivate: () => {} })));
      for (const text of ["Current value", "Proposed value", "Source activity", "Supporting evidence", "Approve selected (2)", "Reject proposal", "72%", "<article", 'type="checkbox"']) assert.ok(html.includes(text), text);
      assert.equal(parseEdit("55", item.proposal.changes[1]), 55);
      client.setQueryData(reviewQueueOptions.queryKey, []);
      const empty = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ReviewWorkspace)));
      assert.ok(empty.includes("Queue cleared"));
    } finally { client.clear(); }
  });
});

test("edited values preserve snapshots and edited provenance through partial approval, rejection, and undo", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    const [stage, probability] = item.proposal.changes;
    const entity = await db.deals.get(stage.entityId);
    await assert.rejects(repo.review(item.proposal.id, { type: "edit", changeId: probability.id, value: 101 }));
    assert.equal(await db.auditEvents.count(), 0);
    const edited = await repo.review(item.proposal.id, { type: "edit", changeId: probability.id, value: 55 });
    assert.equal(edited.changes[1].before, probability.before);
    assert.equal(edited.changes[1].after, 55);
    assert.equal(edited.changes[1].status, "Edited");
    assert.equal(edited.changes[1].edited, true);
    assert.deepEqual(await db.deals.get(stage.entityId), entity);
    const receipt = await repo.approve(item.proposal.id, [probability.id]);
    assert.equal(receipt.after.status, "PartiallyApproved");
    assert.equal(receipt.after.changes[1].edited, true);
    assert.equal(receipt.after.changes[0].status, "Pending");
    const events = await db.auditEvents.toArray();
    assert.deepEqual(new Set(events.map(event => event.action)), new Set(["FieldEdited", "ProposalPartiallyApproved"]));
    const applied = events.find(event => event.action === "ProposalPartiallyApproved")!;
    assert.equal(applied.entityType, "Deal"); assert.equal(applied.entityId, probability.entityId);
    assert.deepEqual(applied.previousValue, { probability: probability.before });
    assert.deepEqual(applied.nextValue, { probability: 55 });
    await repo.undo(receipt);
    assert.deepEqual(await db.proposals.get(item.proposal.id), edited);
    assert.deepEqual(await db.deals.get(stage.entityId), entity);
    const history = await db.auditEvents.toArray();
    assert.equal(history.length, 3);
    assert.ok(events.every(event => history.some(current => JSON.stringify(current) === JSON.stringify(event))));
    assert.equal(history.filter(event => event.action === "ApprovalUndone").length, 1);
    const rejected = await repo.review(item.proposal.id, { type: "reject" });
    assert.equal(rejected.changes[1].status, "Rejected"); assert.equal(rejected.changes[1].edited, true);
    assert.equal(rejected.changes[1].before, probability.before); assert.equal(rejected.changes[1].after, 55);
    assert.equal((await db.auditEvents.toArray()).filter(event => event.action === "ProposalRejected").length, 1);
  });
});

test("stale edited suggestions remain blocked and show captured, current and proposed values", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    const probability = item.proposal.changes[1];
    await db.deals.update(probability.entityId, { probability: 35 });
    await repo.review(item.proposal.id, { type: "edit", changeId: probability.id, value: 60 });
    const stale = (await repo.getQueue()).find(row => row.proposal.id === item.proposal.id)!;
    assert.equal(stale.changes[1].change.before, 20);
    assert.equal(stale.changes[1].current, 35);
    assert.equal(stale.changes[1].change.after, 60);
    assert.equal(stale.changes[1].conflict, true);
    const auditBefore = await db.auditEvents.toArray();
    await assert.rejects(repo.approve(item.proposal.id, item.proposal.changes.map(change => change.id)), /current value changed/);
    assert.equal((await db.deals.get(probability.entityId))!.stage, "Discovery");
    assert.equal((await db.deals.get(probability.entityId))!.probability, 35);
    assert.deepEqual(await db.auditEvents.toArray(), auditBefore);
    const client = createQueryClient();
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ReviewCard, { item: stale, onReviewed: () => {}, active: true, onActivate: () => {} })));
      for (const text of ["stale change", "Stale · approval blocked", "Original captured value:", "20%", "35%", "60%", "Editing the proposed value keeps the snapshot"]) assert.ok(html.includes(text), text);
    } finally { client.clear(); }
  });
});

test("multi-entity approvals and audit append are atomic, including undo, and terminal stages cannot be reopened", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    const contact = (await db.contacts.where("accountId").equals(item.proposal.accountId).toArray())[0];
    const changes = [...item.proposal.changes, { id: "contact-role", entityType: "Contact" as const, entityId: contact.id, field: "role" as const, before: contact.role ?? null, after: "Revenue Operations Lead", selected: true, status: "Pending" as const }];
    await db.proposals.update(item.proposal.id, { changes });
    const fail = () => { throw new Error("Audit append failed"); };
    db.auditEvents.hook("creating", fail);
    await assert.rejects(repo.approve(item.proposal.id, changes.map(change => change.id)), /Audit append failed/);
    db.auditEvents.hook("creating").unsubscribe(fail);
    assert.deepEqual(await db.contacts.get(contact.id), contact);
    assert.equal((await db.deals.get(item.proposal.dealId!))!.stage, "Discovery");
    assert.equal((await db.proposals.get(item.proposal.id))!.status, "Pending");
    assert.equal(await db.auditEvents.count(), 0);
    const receipt = await repo.approve(item.proposal.id, changes.map(change => change.id));
    assert.equal(receipt.after.status, "Approved");
    assert.equal((await db.contacts.get(contact.id))!.role, "Revenue Operations Lead");
    const approved = await db.auditEvents.toArray();
    assert.equal(approved.length, 3);
    assert.ok(approved.every(event => event.action === "ProposalApproved" && event.proposalId === item.proposal.id));
    db.auditEvents.hook("creating", fail);
    await assert.rejects(repo.undo(receipt), /Audit append failed/);
    db.auditEvents.hook("creating").unsubscribe(fail);
    assert.equal((await db.contacts.get(contact.id))!.role, "Revenue Operations Lead");
    assert.equal((await db.deals.get(item.proposal.dealId!))!.stage, "Evaluation");
    assert.deepEqual(await db.proposals.get(item.proposal.id), receipt.after);
    assert.deepEqual(await db.auditEvents.toArray(), approved);
    await repo.undo(receipt);
    assert.deepEqual(await db.contacts.get(contact.id), contact);
    assert.equal(await db.auditEvents.count(), 6);
    await db.deals.update(item.proposal.dealId!, { stage: "ClosedWon" });
    await assert.rejects(repo.review(item.proposal.id, { type: "edit", changeId: changes[0].id, value: "Negotiation" }), /terminal/);
    // Even a structurally valid suggestion captured after closure cannot reopen it.
    await db.proposals.update(item.proposal.id, { changes: [{ ...changes[0], entityType: "Deal", field: "stage", before: "ClosedWon", after: "Negotiation" }] });
    await assert.rejects(repo.approve(item.proposal.id, [changes[0].id]), /terminal/);
    assert.equal((await db.deals.get(item.proposal.dealId!))!.stage, "ClosedWon");
  });
});

test("outcomes and persisted history distinguish applied, skipped, rejected and edited fields", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue())[0];
    await repo.review(item.proposal.id, { type: "edit", changeId: item.proposal.changes[0].id, value: "Proposal" });
    const receipt = await repo.approve(item.proposal.id, [item.proposal.changes[0].id]);
    const html = renderToStaticMarkup(createElement(ReviewOutcome, { proposal: receipt.after, changeIds: receipt.changeIds }));
    for (const text of ["Partially approved", "Applied", "Skipped · awaiting review", "Edited suggestion", "Captured:"]) assert.ok(html.includes(text), text);
    const rejected = await repo.review(item.proposal.id, { type: "reject" });
    const client = createQueryClient();
    try {
      client.setQueryData(queryKeys.accounts.list, await db.accounts.toArray());
      client.setQueryData(queryKeys.proposals.list, [rejected]);
      const history = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ReviewHistory)));
      for (const text of ["Avelmere Systems", "Partially approved", "Rejected · not applied", "Edited suggestion", "append-only audit trail"]) assert.ok(history.includes(text), text);
    } finally { client.clear(); }
    db.close(); await db.open();
    assert.equal((await db.proposals.get(item.proposal.id))!.changes[0].edited, true);
  });
});

test("edited text uses the target field normalization so approval receipts and Undo match persisted values", async () => {
  await workspace(async (db, repo) => {
    const item = (await repo.getQueue()).find(row => row.proposal.changes.some(change => change.field === "nextStep"))!;
    const change = item.proposal.changes.find(change => change.field === "nextStep")!;
    const before = await db.deals.get(change.entityId);
    await db.deals.update(change.entityId, { nextStep: `  ${String(change.before)}  ` });
    await assert.rejects(repo.approve(item.proposal.id, [change.id]), /current value changed/);
    assert.equal((await db.deals.get(change.entityId))!.nextStep, `  ${String(change.before)}  `);
    await db.deals.put(before!);
    await assert.rejects(repo.review(item.proposal.id, { type: "edit", changeId: change.id, value: `  ${String(change.before)}  ` }), /modify the value/);
    const edited = await repo.review(item.proposal.id, { type: "edit", changeId: change.id, value: "  Confirm the legal review timeline.  " });
    assert.equal(edited.changes.find(field => field.id === change.id)!.after, "Confirm the legal review timeline.");
    assert.equal(edited.changes.find(field => field.id === change.id)!.before, change.before);
    const receipt = await repo.approve(item.proposal.id, [change.id], edited);
    assert.equal((await db.deals.get(change.entityId))!.nextStep, "Confirm the legal review timeline.");
    await repo.undo(receipt);
    assert.deepEqual(await db.deals.get(change.entityId), before);
    assert.deepEqual(await db.proposals.get(item.proposal.id), edited);
  });
});

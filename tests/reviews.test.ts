import "fake-indexeddb/auto";
import "./approval.test";
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

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DealPatchDatabase } from "../lib/db/database";
import { createReviewRepository } from "../lib/repositories/reviews";
import { createAuditRepository } from "../lib/repositories/audit";
import { createProposalRepository } from "../lib/repositories/proposals";
import { buildReviewHistory, filterReviewHistory } from "../features/reviews/review-history-model";
import { ReviewHistoryItem } from "../features/reviews/review-history-item";
import { buildDealDetail } from "../features/deals/deal-detail-model";

async function workspace(run: (db: DealPatchDatabase, repo: ReturnType<typeof createReviewRepository>, history: () => Promise<ReturnType<typeof buildReviewHistory>>) => Promise<void>) {
  const db = new DealPatchDatabase(`history-${randomUUID()}`);
  const repo = createReviewRepository(db);
  async function getHistory() { return buildReviewHistory(await repo.getAll(), await createAuditRepository(db).getAll()); }
  try { await run(db, repo, getHistory); } finally { await db.delete(); }
}

test("fully pending and edited-only proposals stay out of history and in actionable counts", async () => workspace(async (db, repo, history) => {
  assert.equal((await history()).length, 0);
  const item = (await repo.getQueue())[0];
  await repo.review(item.proposal.id, { type: "edit", changeId: item.proposal.changes[1].id, value: 55 });
  assert.equal((await history()).length, 0);
  assert.equal((await createProposalRepository(db).getPending()).length, 15);
}));

test("approval appears in read-only history, with audited timestamps and no pending badge contribution", async () => workspace(async (db, repo, history) => {
  const item = (await repo.getQueue())[0];
  await repo.approve(item.proposal.id, item.proposal.changes.map(change => change.id));
  const [entry] = await history();
  assert.equal(entry.status, "Approved");
  assert.ok(entry.reviewedAt);
  assert.deepEqual(entry.fields.map(field => field.outcome), ["Applied", "Applied"]);
  assert.equal((await createProposalRepository(db).getPending()).length, 14);
  const html = renderToStaticMarkup(createElement(ReviewHistoryItem, { entry, expanded: true }));
  for (const text of ["Supporting evidence", "Captured:", "Current value:", "Proposed:", "Audit trail"]) assert.ok(html.includes(text));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes("<input"));
}));

test("rejection preserves source, evidence, changes and audit, leaves CRM unchanged and survives reopen", async () => workspace(async (db, repo, history) => {
  const item = (await repo.getQueue())[0];
  const before = await db.deals.get(item.proposal.dealId!);
  await repo.review(item.proposal.id, { type: "reject" });
  db.close(); await db.open();
  const [entry] = await history();
  assert.equal(entry.status, "Rejected");
  assert.equal(entry.item.proposal.sourceActivityId, item.proposal.sourceActivityId);
  assert.deepEqual(entry.item.proposal.evidence, item.proposal.evidence);
  assert.equal(entry.events[0].action, "ProposalRejected");
  assert.deepEqual(await db.deals.get(item.proposal.dealId!), before);
  assert.ok(renderToStaticMarkup(createElement(ReviewHistoryItem, { entry })).includes("CRM data was not changed."));
  assert.equal((await repo.getQueue()).length, 14);
}));

test("partial approval retains applied, skipped and edited outcomes while remaining actionable", async () => workspace(async (_db, repo, history) => {
  const item = (await repo.getQueue())[0];
  const change = item.proposal.changes[1];
  await repo.review(item.proposal.id, { type: "edit", changeId: change.id, value: 55 });
  await repo.approve(item.proposal.id, [change.id]);
  const [entry] = await history();
  assert.equal(entry.status, "Partially approved");
  assert.deepEqual(entry.fields.map(field => field.outcome), ["Skipped", "Applied"]);
  assert.equal(entry.fields[1].edited, true);
  assert.equal((await repo.getQueue()).length, 15);
  await repo.review(item.proposal.id, { type: "reject" });
  const [finished] = await history();
  assert.equal(finished.status, "Partially approved");
  assert.deepEqual(finished.fields.map(field => field.outcome), ["Rejected", "Applied"]);
}));

test("undo preserves approval and reversal facts and returns proposal to queue, reapproval is applied", async () => workspace(async (_db, repo, history) => {
  const item = (await repo.getQueue())[0];
  const ids = item.proposal.changes.map(change => change.id);
  const receipt = await repo.approve(item.proposal.id, ids);
  await repo.undo(receipt);
  const [entry] = await history();
  assert.equal(entry.status, "Undone / Reverted");
  assert.deepEqual(entry.fields.map(field => field.outcome), ["Reverted", "Reverted"]);
  assert.equal(entry.events.filter(event => event.action === "ProposalApproved").length, 2);
  assert.equal(entry.events.filter(event => event.action === "ApprovalUndone").length, 2);
  assert.equal(filterReviewHistory([entry], { status: "Undone / Reverted" }).length, 1);
  assert.equal((await repo.getQueue()).length, 15);
  await repo.approve(item.proposal.id, ids);
  const [again] = await history();
  assert.equal(again.status, "Approved");
  assert.ok(again.fields.every(field => field.outcome === "Applied"));
  assert.equal(again.events.length, 6);
}));

test("history search, status/account filters, ordering and superseded records", async () => workspace(async (db, repo, history) => {
  const [first, second, third] = await repo.getQueue();
  await repo.review(first.proposal.id, { type: "reject" });
  await repo.approve(second.proposal.id, second.proposal.changes.map(change => change.id));
  await db.proposals.update(third.proposal.id, { status: "Superseded" });
  const entries = await history();
  assert.equal(filterReviewHistory(entries, { status: "Rejected" }).length, 1);
  assert.equal(filterReviewHistory(entries, { status: "Approved" }).length, 1);
  assert.equal(filterReviewHistory(entries, { status: "Superseded" }).length, 1);
  assert.equal(filterReviewHistory(entries, { search: "AVELMERE probab" }).length, 1);
  assert.equal(filterReviewHistory(entries, { accountId: first.proposal.accountId }).length, 1);
  assert.equal(filterReviewHistory(entries, { search: "no-such-company" }).length, 0);
  assert.deepEqual(filterReviewHistory(entries, { oldest: true }).map(entry => entry.item.proposal.id), filterReviewHistory(entries, {}).map(entry => entry.item.proposal.id).reverse());
  assert.equal(entries.find(entry => entry.status === "Superseded")?.reviewedAt, undefined);
}));

test("Deal Detail retains completed and reverted reviews with original approval and undo audit", async () => workspace(async (db, repo) => {
  const item = (await repo.getQueue())[0];
  const receipt = await repo.approve(item.proposal.id, item.proposal.changes.map(change => change.id));
  await repo.undo(receipt);
  const deal = (await db.deals.get(item.proposal.dealId!))!;
  const detail = buildDealDetail(deal, await db.accounts.toArray(), await db.contacts.toArray(), await db.deals.toArray(), await db.activities.toArray(), await db.proposals.toArray(), await createAuditRepository(db).getAll(), new Date());
  assert.ok(detail.proposals.some(proposal => proposal.id === item.proposal.id));
  assert.ok(detail.auditEvents.some(event => event.action === "ProposalApproved"));
  assert.ok(detail.auditEvents.some(event => event.action === "ApprovalUndone"));
}));


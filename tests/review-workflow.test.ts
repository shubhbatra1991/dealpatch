import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Proposal } from "../domain/proposals/proposal";
import { DealPatchDatabase } from "../lib/db/database";
import { createReviewRepository, type ReviewItem } from "../lib/repositories/reviews";
import { createProposalRepository } from "../lib/repositories/proposals";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { reviewActionMutationOptions } from "../features/reviews/review-action-mutations";
import { filterReviewItems, selectedReview } from "../features/reviews/review-model";
import { ReviewList } from "../features/reviews/review-list";
import { ReviewWorkspace } from "../features/reviews/review-workspace";
import { renderWithKeyboard } from "./keyboard-provider";

test("all review statuses persist, pending filtering retains unfinished partial work, and stale is derived", async () => {
  const db = new DealPatchDatabase(`review-history-${randomUUID()}`);
  try {
    const repo = createReviewRepository(db);
    const initial = await repo.getAll();
    await repo.approve(initial[0].proposal.id, initial[0].proposal.changes.map(change => change.id));
    await repo.review(initial[1].proposal.id, { type: "reject" });
    const multiple = initial.find(item => !initial.slice(0, 2).some(first => first.proposal.id === item.proposal.id) && item.proposal.changes.length > 1)!;
    await repo.approve(multiple.proposal.id, [multiple.proposal.changes[0].id]);
    const superseded = initial.find(item => ![initial[0].proposal.id, initial[1].proposal.id, multiple.proposal.id].includes(item.proposal.id))!;
    await db.proposals.update(superseded.proposal.id, { status: "Superseded" });
    const remaining = (await repo.getQueue()).find(item => item.proposal.id !== multiple.proposal.id && item.changes.some(row => row.change.entityType === "Deal" && row.change.field === "probability"))!;
    const probability = remaining.changes.find(row => row.change.field === "probability")!;
    await db.deals.update(probability.change.entityId, { probability: probability.current === 35 ? 36 : 35 });
    db.close(); await db.open();
    const all = await repo.getAll();
    assert.equal(all.length, 15);
    assert.equal(filterReviewItems(all, "Approved").length, 1);
    assert.equal(filterReviewItems(all, "Rejected").length, 1);
    assert.equal(filterReviewItems(all, "Superseded").length, 1);
    assert.equal(filterReviewItems(all, "Partially approved").length, 1);
    assert.ok(filterReviewItems(all, "Pending work").some(item => item.proposal.id === multiple.proposal.id));
    assert.ok(filterReviewItems(all, "Stale").some(item => item.proposal.id === remaining.proposal.id));
    assert.deepEqual(filterReviewItems(all, "Pending work"), await repo.getQueue());
    await repo.review(multiple.proposal.id, { type: "reject" });
    const complete = await repo.getAll();
    assert.equal(filterReviewItems(complete, "Partially approved").length, 1);
    assert.ok(!filterReviewItems(complete, "Pending work").some(item => item.proposal.id === multiple.proposal.id));
    assert.equal(selectedReview(complete, filterReviewItems(complete, "Pending work"), multiple.proposal.id)?.proposal.status, "PartiallyApproved");
  } finally { await db.delete(); }
});

test("compact list exposes one tab stop while focused and reviewed details retain navigation, evidence and outcomes", async () => {
  const db = new DealPatchDatabase(`review-surface-${randomUUID()}`);
  const client = createQueryClient();
  try {
    const repo = createReviewRepository(db);
    const items = await repo.getAll();
    const list = renderWithKeyboard(createElement(ReviewList, { items, selectedId: items[0].proposal.id, onSelect: () => {}, onOpen: () => {} }));
    assert.equal((list.match(/tabindex="0"/g) ?? []).length, 1);
    assert.equal((list.match(/data-review-id=/g) ?? []).length, 15);
    assert.doesNotMatch(list, /Current value|type="checkbox"/);
    assert.ok(list.includes(items[0].proposal.evidence[0].text));
    client.setQueryData(queryKeys.proposals.reviewItems, items);
    client.setQueryData(queryKeys.proposals.queue, await repo.getQueue());
    const render = (id?: string) => renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(ReviewWorkspace, { targetProposalId: id })));
    assert.equal((render().match(/<article/g) ?? []).length, 1, "only the selected diff is expanded");
    const first = items[0].proposal;
    const receipt = await repo.approve(first.id, first.changes.map(change => change.id));
    client.setQueryData(queryKeys.proposals.reviewItems, await repo.getAll());
    client.setQueryData(queryKeys.proposals.queue, await repo.getQueue());
    const html = render(first.id);
    for (const value of ["Approval complete", "Current value", "Proposed value", "Supporting evidence", "Audit trail", "Related records"]) assert.ok(html.includes(value), value);
    assert.ok(html.includes(`/workspace/accounts/${encodeURIComponent(first.accountId)}`));
    assert.ok(html.includes(`/workspace/deals/${encodeURIComponent(first.dealId!)}`));
    assert.ok(html.includes(`/workspace/activity?activity=${encodeURIComponent(first.sourceActivityId)}`));
    assert.match(html, /disabled=""[^>]*>Approve all \(0\)/);
    assert.match(html, /disabled=""[^>]*>Reject proposal/);
    assert.match(render("missing"), /selected proposal is no longer/);
    assert.equal(receipt.after.status, "Approved");
  } finally { client.clear(); await db.delete(); }
});

test("validated edits and rejection publish to every review cache and badge; failed or out-of-date decisions preserve state", async () => {
  const db = new DealPatchDatabase(`review-actions-${randomUUID()}`);
  const client = createQueryClient();
  try {
    const repo = createReviewRepository(db);
    const items = await repo.getAll();
    const item = items[0];
    const proposalRepo = createProposalRepository(db);
    client.setQueryData(queryKeys.proposals.reviewItems, items);
    client.setQueryData(queryKeys.proposals.queue, items);
    client.setQueryData(queryKeys.proposals.pending, await proposalRepo.getPending());
    client.setQueryData(queryKeys.proposals.list, await proposalRepo.getAll());
    const execute = (request: Parameters<NonNullable<ReturnType<typeof reviewActionMutationOptions>["mutationFn"]>>[0]) => client.getMutationCache().build(client, reviewActionMutationOptions(client, repo)).execute(request);
    const probability = item.proposal.changes.find(change => change.field === "probability")!;
    const before = await db.deals.get(probability.entityId);
    await assert.rejects(execute({ id: item.proposal.id, expectedProposal: item.proposal, action: { type: "edit", changeId: probability.id, value: 101 } }));
    assert.equal(await db.auditEvents.count(), 0);
    const edited = await execute({ id: item.proposal.id, expectedProposal: item.proposal, action: { type: "edit", changeId: probability.id, value: 55 } });
    assert.equal(edited.changes[1].before, probability.before);
    assert.equal(client.getQueryData<ReviewItem[]>(queryKeys.proposals.reviewItems)![0].changes[1].change.status, "Edited");
    assert.deepEqual(await db.deals.get(probability.entityId), before);
    await assert.rejects(execute({ id: item.proposal.id, expectedProposal: item.proposal, action: { type: "reject" } }), /edited or reviewed/);
    const rejected = await execute({ id: edited.id, expectedProposal: edited, action: { type: "reject" } });
    assert.equal(rejected.status, "Rejected");
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 14);
    assert.equal(client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)!.length, 14);
    assert.equal(client.getQueryData<ReviewItem[]>(queryKeys.proposals.reviewItems)!.length, 15);
    assert.equal(client.getQueryData<ReviewItem[]>(queryKeys.proposals.reviewItems)![0].proposal.status, "Rejected");
    assert.deepEqual(await db.deals.get(probability.entityId), before);
    assert.deepEqual(new Set((await db.auditEvents.toArray()).map(event => event.action)), new Set(["FieldEdited", "ProposalRejected"]));
    const other = items[1].proposal;
    const failure = client.getMutationCache().build(client, reviewActionMutationOptions(client, { review: async () => { throw new Error("Write failed"); } }));
    await assert.rejects(failure.execute({ id: other.id, expectedProposal: other, action: { type: "reject" } }), /Write failed/);
    assert.equal(client.getQueryData<Proposal[]>(queryKeys.proposals.pending)!.length, 14);
    assert.equal(client.getQueryData<ReviewItem[]>(queryKeys.proposals.reviewItems)!.find(item => item.proposal.id === other.id)!.proposal.status, "Pending");
  } finally { client.clear(); await db.delete(); }
});

import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import Dexie from "dexie";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import { DealPatchDatabase } from "../lib/db/database";
import { VERSION_1_STORES } from "../lib/db/schema";
import { initializeWorkspace } from "../lib/db/workspace";
import { createAuditRepository, auditRepository } from "../lib/repositories/audit";
import { createReviewRepository } from "../lib/repositories/reviews";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { finishReviewWrite } from "../features/reviews/approval-mutations";
import { accountAuditOptions } from "../features/accounts/use-account-data";
import { AccountDetailWorkspace } from "../features/accounts/account-detail-workspace";
import { AccountTabContent } from "../features/accounts/account-detail-sections";
import { buildAccountDetail } from "../features/accounts/accounts-model";
import type { Account } from "../domain/accounts/account";
import type { AuditEvent } from "../domain/audit/audit.types";

const now = new Date("2026-10-08T12:00:00Z");
const account: Account = { id: "opaque-account", name: "Brenlow Systems", status: "Active", ownerId: "owner", createdAt: now.toISOString(), updatedAt: now.toISOString() };

async function workspace(run: (db: DealPatchDatabase) => Promise<void>) {
  const db = new DealPatchDatabase(`account-detail-${randomUUID()}`);
  try { await initializeWorkspace(db); await run(db); } finally { await db.delete(); }
}

test("v1 upgrade preserves edited records and creates empty audit storage without inventing history", async () => {
  const name = `account-migration-${randomUUID()}`;
  const previous = new Dexie(name);
  previous.version(1).stores(VERSION_1_STORES);
  await previous.table("accounts").add({ ...account, name: "Locally edited company" });
  previous.close();
  const current = new DealPatchDatabase(name);
  try {
    await initializeWorkspace(current);
    assert.equal((await current.accounts.get(account.id))?.name, "Locally edited company");
    assert.equal(await current.accounts.count(), 1);
    assert.equal(await current.auditEvents.count(), 0);
    current.close(); await current.open();
    assert.equal(await current.accounts.count(), 1);
  } finally { await current.delete(); }
});

test("approvals and undo append real, account-scoped events and audit failure rolls back the whole review", async () => {
  await workspace(async db => {
    const reviews = createReviewRepository(db);
    const row = (await reviews.getQueue())[0];
    const change = row.proposal.changes[0];
    const receipt = await reviews.approve(row.proposal.id, [change.id]);
    const audit = createAuditRepository(db);
    const original = await audit.getByAccountId(row.proposal.accountId);
    assert.equal(original.length, 1);
    assert.equal(original[0].action, "ProposalPartiallyApproved");
    assert.deepEqual(original[0].previousValue, { [change.field]: change.before });
    assert.deepEqual(original[0].nextValue, { [change.field]: change.after });
    await reviews.undo(receipt);
    const history = await audit.getByAccountId(row.proposal.accountId);
    assert.equal(history.length, 2);
    assert.deepEqual(history.find(event => event.id === original[0].id), original[0]);
    assert.equal(history.filter(event => event.action === "ApprovalUndone").length, 1);
    const otherAccount = (await db.accounts.toArray()).find(record => record.id !== row.proposal.accountId)!;
    assert.deepEqual(await audit.getByAccountId(otherAccount.id), []);
    assert.deepEqual(await audit.getByAccountId("missing"), []);
    const fail = () => { throw new Error("Audit unavailable"); };
    db.auditEvents.hook("creating", fail);
    await assert.rejects(reviews.approve(row.proposal.id, [change.id]), /Audit unavailable/);
    db.auditEvents.hook("creating").unsubscribe(fail);
    assert.deepEqual(await db.proposals.get(row.proposal.id), receipt.before);
    assert.deepEqual(await audit.getByAccountId(row.proposal.accountId), history);
    const restored = await db.deals.get(change.entityId);
    assert.equal(Reflect.get(restored!, change.field), change.before);
    db.close(); await db.open();
    assert.equal((await audit.getByAccountId(row.proposal.accountId)).length, 2);
  });
});

test("suggestion edits and rejections record proposal state without claiming a CRM field was applied", async () => {
  await workspace(async db => {
    const reviews = createReviewRepository(db);
    const row = (await reviews.getQueue()).find(item => item.proposal.changes.some(change => change.field === "nextStep"))!;
    const change = row.proposal.changes.find(change => change.field === "nextStep")!;
    const before = await db.deals.get(change.entityId);
    await reviews.review(row.proposal.id, { type: "edit", changeId: change.id, value: "Confirm the updated review timeline." });
    await reviews.review(row.proposal.id, { type: "reject" });
    const history = await createAuditRepository(db).getByAccountId(row.proposal.accountId);
    assert.deepEqual(new Set(history.map(event => event.action)), new Set(["FieldEdited", "ProposalRejected"]));
    assert.ok(history.every(event => event.entityType === "Proposal" && event.proposalId === row.proposal.id));
    assert.deepEqual(await db.deals.get(change.entityId), before);
  });
});

test("detail projection resolves current values, participants and deal relationships without leaking another account", () => {
  const deal = { id: "deal", accountId: account.id, title: "Regional rollout", stage: "Evaluation" as const, value: 1200, currency: "EUR", probability: 45, ownerId: "owner", risk: "Low" as const };
  const person = { id: "person", accountId: account.id, firstName: "Mara", lastName: "Brenlow", status: "Active" as const };
  const activity = { id: "activity", accountId: account.id, dealId: deal.id, title: "Sponsor call", type: "Call" as const, summary: "Scope agreed", occurredAt: now.toISOString(), participants: [person.id, "foreign-person"] };
  const proposal = { id: "proposal", accountId: account.id, dealId: deal.id, sourceActivityId: activity.id, status: "Pending" as const, confidence: 90, createdAt: now.toISOString(), evidence: [], changes: [{ id: "change", entityType: "Deal" as const, entityId: deal.id, field: "stage" as const, before: "Discovery" as const, after: "Proposal" as const, selected: true, status: "Pending" as const }] };
  const ownAudit: AuditEvent = { id: "audit", entityType: "Deal", entityId: deal.id, action: "ProposalApproved", previousValue: "Discovery", nextValue: "Evaluation", proposalId: null, occurredAt: now.toISOString() };
  const data = buildAccountDetail(account.id, [deal, { ...deal, id: "foreign-deal", accountId: "other" }], [person, { ...person, id: "foreign-person", accountId: "other", firstName: "Private" }], [activity], [proposal], now, { account, auditEvents: [ownAudit, { ...ownAudit, id: "foreign-audit", entityId: "foreign-deal" }] });
  assert.equal(data.activities[0].relatedDeal?.id, deal.id);
  assert.deepEqual(data.activities[0].participantLabels.map(person => person.name), ["Mara Brenlow", "Unavailable contact"]);
  assert.deepEqual(data.auditEvents, [ownAudit]);
  const diff = data.proposalChanges.get(proposal.id)![0];
  assert.equal(diff.current, "Evaluation"); assert.equal(diff.change.before, "Discovery"); assert.equal(diff.stale, true);
  const changes = renderToStaticMarkup(createElement(AccountTabContent, { tab: "Changes", data }));
  assert.match(changes, /Current value: <\/span>Evaluation/);
  assert.match(changes, /Stale suggestion/);
  assert.match(changes, /Generation snapshot: Discovery/);
  assert.match(changes, /Proposal approved/);
  const activities = renderToStaticMarkup(createElement(AccountTabContent, { tab: "Activity", data }));
  assert.match(activities, /Related deal/); assert.match(activities, /Mara Brenlow/); assert.doesNotMatch(activities, /Private/);
  const opportunities = renderToStaticMarkup(createElement(AccountTabContent, { tab: "Opportunities", data }));
  assert.match(opportunities, /Probability/); assert.match(opportunities, /45%/);
});

test("audit queries delegate through the repository, invalidate after writes and keep SSR storage-free", async (t) => {
  const read = t.mock.method(auditRepository, "getByAccountId", async () => []);
  const client = createQueryClient();
  try {
    const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(AccountDetailWorkspace, { accountId: account.id })));
    assert.match(render(), /Loading account data/);
    assert.equal(read.mock.callCount(), 0);
    await client.fetchQuery(accountAuditOptions(account.id));
    assert.deepEqual(read.mock.calls[0].arguments, [account.id]);
    await finishReviewWrite(client);
    assert.equal(client.getQueryState(queryKeys.audit.forAccount(account.id))?.isInvalidated, true);
    client.setQueryData(queryKeys.accounts.list, []);
    assert.match(render(), /Account not found/);
  } finally { client.clear(); }
});

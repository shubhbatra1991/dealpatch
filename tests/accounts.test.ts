import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTable, functionalUpdate, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import type { Account } from "../domain/accounts/account";
import type { Deal } from "../domain/deals/deal";
import type { Contact } from "../domain/contacts/contact";
import type { Activity } from "../domain/activities/activity";
import type { Proposal } from "../domain/proposals/proposal";
import { buildAccountRows, buildAccountDetail, matchesAccountSearch, missingRegionFilter, accountHref } from "../features/accounts/accounts-model";
import { accountColumns } from "../features/accounts/accounts-columns";
import { AccountsTable } from "../features/accounts/accounts-table";
import { AccountsWorkspace } from "../features/accounts/accounts-workspace";
import { AccountDetailWorkspace, AccountDetailView } from "../features/accounts/account-detail-workspace";
import { AccountTabContent } from "../features/accounts/account-detail-sections";
import { accountContactsOptions, accountProposalsOptions } from "../features/accounts/use-account-data";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { DealPatchDatabase } from "../lib/db/database";
import { createContactRepository, contactRepository } from "../lib/repositories/contacts";
import { createProposalRepository, proposalRepository } from "../lib/repositories/proposals";
import { createAccountRepository } from "../lib/repositories/accounts";
import { createReviewRepository } from "../lib/repositories/reviews";
import { finishReviewWrite } from "../features/reviews/approval-mutations";
import { renderWithKeyboard } from "./keyboard-provider";

const now = new Date("2026-10-08T12:00:00Z");
const account: Account = { id: "account", name: "Brenlow Systems", ownerId: "owner", status: "Active", industry: "Software", region: "North", createdAt: now.toISOString(), updatedAt: now.toISOString() };
const foreign: Account = { ...account, id: "other", name: "Torvellan Works", status: "Dormant", region: "South" };
const deal: Deal = { id: "deal", accountId: account.id, title: "Regional rollout", stage: "Evaluation", value: 100, currency: "EUR", probability: 30, ownerId: "owner", risk: "High", nextStep: "Discuss scope", expectedCloseDate: "2026-10-07", lastActivityAt: "2026-09-01T00:00:00Z" };
const contact: Contact = { id: "person", accountId: account.id, firstName: "Mara", lastName: "Brenlow", status: "Active", role: "Director" };
const activity: Activity = { id: "activity", accountId: account.id, dealId: deal.id, type: "Meeting", title: "Scope call", summary: "Scope agreed", occurredAt: "2026-10-08T10:00:00Z" };
const proposal: Proposal = { id: "proposal", accountId: account.id, dealId: deal.id, sourceActivityId: activity.id, status: "Pending", confidence: 90, createdAt: now.toISOString(), evidence: [{ type: "activity_excerpt", sourceActivityId: activity.id, text: "Scope agreed" }], changes: [{ id: "change", entityType: "Deal", entityId: deal.id, field: "stage", before: "Evaluation", after: "Proposal", selected: true, status: "Pending" }] };

test("account aggregates retain every account, exclude closed pipeline and keep currencies separate", () => {
  const deals: Deal[] = [deal, { ...deal, id: "usd", value: 200, currency: "USD" }, { ...deal, id: "won", stage: "ClosedWon", value: 9000 }, { ...deal, id: "foreign", accountId: foreign.id }];
  const rows = buildAccountRows([account, foreign, { ...account, id: "empty" }], deals, [activity], [proposal, { ...proposal, id: "approved", status: "Approved" }]);
  assert.equal(rows[0].openDeals, 2);
  assert.deepEqual(rows[0].pipeline, [{ currency: "EUR", value: 100 }, { currency: "USD", value: 200 }]);
  assert.equal(rows[0].lastActivityAt, activity.occurredAt);
  assert.equal(rows[0].pendingReviews, 1);
  assert.equal(rows[1].pendingReviews, 0);
  assert.equal(rows[2].openDeals, 0);
  assert.deepEqual(rows[2].pipeline, []);
  assert.equal(rows[2].lastActivityAt, undefined);
  assert.ok(matchesAccountSearch(rows[0], "  brenlow   SOFTWARE  north  "));
  assert.equal(matchesAccountSearch(rows[0], "South"), false);
  assert.equal(accountHref("opaque/id ?#"), "/accounts/opaque%2Fid%20%3F%23");
});

test("actual account columns compose exact status/region filters and numeric sorting", () => {
  const data = buildAccountRows([account, foreign, { ...account, id: "blank", region: undefined }], [deal, { ...deal, id: "extra", accountId: foreign.id }], [], [proposal]);
  const table = createTable({ data, columns: accountColumns, state: {}, onStateChange: () => {}, renderFallbackValue: null, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel() });
  table.setOptions(options => ({ ...options, state: table.initialState, onStateChange: update => table.setOptions(current => ({ ...current, state: functionalUpdate(update, { ...table.initialState, ...current.state }) })) }));
  table.getColumn("status")!.setFilterValue("Active");
  table.getColumn("region")!.setFilterValue("North");
  assert.deepEqual(table.getRowModel().rows.map(row => row.original.id), [account.id]);
  table.getColumn("region")!.setFilterValue(missingRegionFilter);
  assert.deepEqual(table.getRowModel().rows.map(row => row.original.id), ["blank"]);
  table.setColumnFilters([]);
  table.setSorting([{ id: "pendingReviews", desc: true }]);
  assert.equal(table.getRowModel().rows[0].original.id, account.id);
  table.setSorting([{ id: "pipeline", desc: false }]);
  assert.equal(table.getRowModel().rows[0].original.id, "blank");
});

test("detail joins only this account, includes closed opportunities and reviewed history, and derives risks from current activity", () => {
  const data = buildAccountDetail(account.id, [deal, { ...deal, id: "closed", stage: "ClosedLost" }, { ...deal, id: "foreign", accountId: foreign.id }], [contact, { ...contact, id: "other-person", accountId: foreign.id }], [activity, { ...activity, id: "other-activity", accountId: foreign.id }], [proposal, { ...proposal, id: "done", status: "Approved" }, { ...proposal, id: "other-proposal", accountId: foreign.id }], now);
  assert.equal(data.open.length, 1);
  assert.equal(data.opportunities.length, 2);
  assert.equal(data.contacts.length, 1);
  assert.equal(data.activities.length, 1);
  assert.equal(data.proposals.length, 2);
  assert.equal(data.pending.length, 1);
  assert.deepEqual(data.risks[0].reasons, ["High risk", "Overdue close"]);
  assert.equal(data.lastActivityAt, activity.occurredAt);
});

test("semantic list and detail views escape text, guard websites, and expose all tabs and account-specific content", () => {
  const rows = buildAccountRows([account], [deal], [activity], [proposal]);
  const list = renderWithKeyboard(createElement(AccountsTable, { data: rows }));
  for (const label of ["Account", "Status", "Industry", "Region", "Owner", "Open Deals", "Open Pipeline Value", "Last Activity", "Pending Reviews"]) assert.ok(list.includes(label));
  assert.ok(list.includes('href="/accounts/account"'));
  assert.match(renderWithKeyboard(createElement(AccountsTable, { data: [] })), /No accounts yet/);
  const data = buildAccountDetail(account.id, [deal], [contact], [activity], [proposal], now);
  const detail = renderToStaticMarkup(createElement(QueryClientProvider, { client: createQueryClient() }, createElement(AccountDetailView, { account: { ...account, name: "<script>name</script>", website: "javascript:alert(1)" }, data })));
  assert.match(detail, /&lt;script&gt;name&lt;\/script&gt;/);
  assert.doesNotMatch(detail, /href="javascript:/);
  assert.equal((detail.match(/role="tab"/g) ?? []).length, 5);
  assert.equal((detail.match(/role="tabpanel"/g) ?? []).length, 5);
  assert.match(renderToStaticMarkup(createElement(QueryClientProvider, { client: createQueryClient() }, createElement(AccountDetailView, { account: { ...account, website: "https://brenlow.example" }, data }))), /rel="noopener noreferrer"/);
  for (const tab of ["Contacts", "Opportunities", "Activity", "Changes"] as const) {
    const html = renderToStaticMarkup(createElement(AccountTabContent, { tab, data }));
    assert.ok(html.includes(tab === "Contacts" ? "Mara" : tab === "Opportunities" ? "Regional rollout" : tab === "Activity" ? "Scope call" : "Generation snapshot"));
  }
});

test("account queries are lazy on SSR and loading, missing-account and storage-error states are explicit", async (t) => {
  const contacts = t.mock.method(contactRepository, "getByAccountId", async () => [contact]);
  const proposals = t.mock.method(proposalRepository, "getByAccountId", async () => [proposal]);
  const client = createQueryClient();
  const render = (element: ReturnType<typeof createElement>) => renderWithKeyboard(createElement(QueryClientProvider, { client }, element));
  try {
    assert.match(render(createElement(AccountsWorkspace)), /Loading account data/);
    assert.match(render(createElement(AccountDetailWorkspace, { accountId: account.id })), /Loading account data/);
    assert.equal(contacts.mock.callCount(), 0);
    assert.equal(proposals.mock.callCount(), 0);
    assert.deepEqual(await client.fetchQuery(accountContactsOptions(account.id)), [contact]);
    assert.deepEqual(await client.fetchQuery(accountProposalsOptions(account.id)), [proposal]);
    assert.deepEqual(contacts.mock.calls[0].arguments, [account.id]);
    client.setQueryData(queryKeys.accounts.list, []);
    assert.match(render(createElement(AccountDetailWorkspace, { accountId: "missing" })), /Account not found/);
    await assert.rejects(client.fetchQuery({ queryKey: queryKeys.deals.list, queryFn: async () => { throw new Error("Storage blocked"); } }), /Storage blocked/);
    assert.match(render(createElement(AccountsWorkspace)), /Unable to load account data from local storage/);
    client.setQueryData(queryKeys.contacts.forAccount(account.id), [contact]);
    await finishReviewWrite(client);
    assert.equal(client.getQueryState(queryKeys.contacts.forAccount(account.id))?.isInvalidated, true);
    assert.equal(client.getQueryState(queryKeys.proposals.forAccount(account.id))?.isInvalidated, true);
  } finally { client.clear(); }
});

test("account-scoped reads persist related data and proposal review states across reopening", async () => {
  const db = new DealPatchDatabase(`account-surface-${randomUUID()}`);
  try {
    const accounts = await createAccountRepository(db).getAll();
    const people = createContactRepository(db);
    const proposals = createProposalRepository(db);
    const target = accounts[0].id;
    assert.ok((await people.getByAccountId(target)).every(person => person.accountId === target));
    assert.deepEqual(await people.getByAccountId("missing"), []);
    const history = await proposals.getByAccountId(target);
    assert.ok(history.length > 0);
    assert.ok(history.every(proposal => proposal.accountId === target));
    const review = createReviewRepository(db);
    await review.review(history[0].id, { type: "reject" });
    db.close();
    await db.open();
    assert.equal((await proposals.getByAccountId(target)).find(proposal => proposal.id === history[0].id)?.status, "Rejected");
    assert.deepEqual(await proposals.getByAccountId("missing"), []);
  } finally { await db.delete(); }
});

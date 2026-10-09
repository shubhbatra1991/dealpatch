import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTable, functionalUpdate, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import type { Account } from "../domain/accounts/account";
import type { Contact } from "../domain/contacts/contact";
import type { Deal } from "../domain/deals/deal";
import type { Activity } from "../domain/activities/activity";
import type { Proposal } from "../domain/proposals/proposal";
import type { AuditEvent } from "../domain/audit/audit.types";
import { buildContactRows, matchesContactSearch, missingContactRegion, contactHref } from "../features/contacts/contacts-model";
import { buildContactDetail } from "../features/contacts/contact-detail-model";
import { contactColumns } from "../features/contacts/contacts-columns";
import { ContactsTable } from "../features/contacts/contacts-table";
import { ContactsWorkspace } from "../features/contacts/contacts-workspace";
import { ContactDetailWorkspace, ContactDetailView } from "../features/contacts/contact-detail-workspace";
import { ContactsQueryState } from "../features/contacts/contacts-query-state";
import { contactsQueryOptions } from "../features/contacts/use-contacts";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { DealPatchDatabase } from "../lib/db/database";
import { createContactRepository, contactRepository } from "../lib/repositories/contacts";
import { finishReviewWrite } from "../features/reviews/approval-mutations";
import { renderWithKeyboard } from "./keyboard-provider";

const now = new Date("2026-10-08T12:00:00Z");
const account: Account = { id: "a", name: "Brenlow Systems", ownerId: "owner", status: "Active", region: "North", createdAt: now.toISOString(), updatedAt: now.toISOString() };
const contact: Contact = { id: "c", accountId: account.id, firstName: "Mara", lastName: "Corven", role: "Director", email: "mara@brenlow.example", status: "Active" };
const colleague: Contact = { ...contact, id: "colleague", firstName: "Elias", status: "Inactive" };
const deal: Deal = { id: "d", accountId: account.id, title: "Regional rollout", stage: "Evaluation", value: 100, currency: "EUR", probability: 45, risk: "Low", ownerId: "owner" };
const activity: Activity = { id: "activity", accountId: account.id, dealId: deal.id, type: "Meeting", title: "Scope agreed", summary: "Scope agreed", occurredAt: now.toISOString(), participants: [contact.id] };
const proposal: Proposal = { id: "p", accountId: account.id, sourceActivityId: activity.id, status: "Pending", confidence: 90, createdAt: now.toISOString(), evidence: [], changes: [
  { id: "contact-change", entityType: "Contact", entityId: contact.id, field: "role", before: "Manager", after: "VP Sales", selected: true, status: "Pending" },
  { id: "colleague-change", entityType: "Contact", entityId: colleague.id, field: "role", before: "Director", after: "Private colleague suggestion", selected: true, status: "Pending" },
  { id: "deal-change", entityType: "Deal", entityId: deal.id, field: "stage", before: "Evaluation", after: "Negotiation", selected: true, status: "Pending" },
] };

test("contact metrics distinguish account deals from explicit participation and unresolved contact changes", () => {
  const people = [contact, colleague, { ...contact, id: "orphan", accountId: "missing" }];
  const rows = buildContactRows(people, [account], [deal, { ...deal, id: "won", stage: "ClosedWon" }, { ...deal, id: "lost", stage: "ClosedLost" }], [activity, { ...activity, id: "foreign", accountId: "other", occurredAt: "2026-10-09T00:00:00Z" }], [proposal, { ...proposal, id: "done", status: "Approved" }, { ...proposal, id: "partial", status: "PartiallyApproved", changes: proposal.changes.map(change => change.entityId === contact.id ? { ...change, status: "Approved" } : change) }, { ...proposal, id: "foreign", accountId: "other" }]);
  assert.equal(rows[0].openDeals, 1);
  assert.equal(rows[1].openDeals, 1);
  assert.equal(rows[0].pendingReviews, 1);
  assert.equal(rows[1].pendingReviews, 2);
  assert.equal(rows[0].lastActivityAt, activity.occurredAt);
  assert.equal(rows[1].lastActivityAt, undefined);
  assert.equal(rows[2].accountAvailable, false);
  assert.equal(rows[2].openDeals, 0);
  assert.equal(rows[2].region, undefined);
  assert.ok(matchesContactSearch(rows[0], " MARA director brenlow mara@ "));
  assert.equal(matchesContactSearch(rows[0], "Elias"), false);
  assert.equal(contactHref("opaque/id ?#"), "/contacts/opaque%2Fid%20%3F%23");
});

test("actual contact table combines search/status/account/region filters and sorts derived counts numerically", () => {
  const rows = buildContactRows([contact, colleague, { ...contact, id: "blank", accountId: "missing" }], [account], [deal], [activity], [proposal]);
  const table = createTable({ data: rows, columns: contactColumns, state: {}, onStateChange: () => {}, renderFallbackValue: null, getRowId: row => row.id, getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getColumnCanGlobalFilter: column => column.id === "name", globalFilterFn: (row, _id, value: string) => matchesContactSearch(row.original, value) });
  table.setOptions(options => ({ ...options, state: table.initialState, onStateChange: update => table.setOptions(current => ({ ...current, state: functionalUpdate(update, { ...table.initialState, ...current.state }) })) }));
  table.setGlobalFilter("Brenlow Director");
  table.setColumnFilters([{ id: "status", value: "Active" }, { id: "accountId", value: account.id }, { id: "region", value: "North" }]);
  assert.deepEqual(table.getRowModel().rows.map(row => row.id), [contact.id]);
  table.getColumn("region")!.setFilterValue("South");
  assert.equal(table.getRowModel().rows.length, 0);
  table.setGlobalFilter(""); table.setColumnFilters([{ id: "region", value: missingContactRegion }]);
  assert.deepEqual(table.getRowModel().rows.map(row => row.id), ["blank"]);
  table.setColumnFilters([]); table.setSorting([{ id: "openDeals", desc: false }]);
  assert.equal(table.getRowModel().rows[0].id, "blank");
  table.setSorting([{ id: "name", desc: false }]);
  assert.equal(table.getRowModel().rows[0].id, colleague.id);
});

test("contact detail scopes mixed diffs, audits and participation while retaining source evidence", () => {
  const events: AuditEvent[] = [
    { id: "own", entityType: "Contact", entityId: contact.id, action: "ProposalApproved", proposalId: proposal.id, previousValue: "Manager", nextValue: "Director", occurredAt: now.toISOString() },
    { id: "other", entityType: "Contact", entityId: colleague.id, action: "ProposalApproved", proposalId: proposal.id, previousValue: "Manager", nextValue: "Director", occurredAt: now.toISOString() },
    { id: "deal-audit", entityType: "Deal", entityId: deal.id, action: "ProposalApproved", proposalId: proposal.id, previousValue: "Evaluation", nextValue: "Negotiation", occurredAt: now.toISOString() },
  ];
  const detail = buildContactDetail(contact, [account], [contact, colleague], [deal, { ...deal, id: "unrelated" }], [activity, { ...activity, id: "nonparticipant", participants: [colleague.id] }, { ...activity, id: "foreign", accountId: "other" }], [proposal, { ...proposal, id: "foreign", accountId: "other" }], events, now);
  assert.deepEqual(detail.data.activities.map(record => record.id), [activity.id]);
  assert.deepEqual(detail.data.opportunities.map(record => record.id), [deal.id]);
  assert.deepEqual(detail.data.auditEvents.map(record => record.id), ["own"]);
  assert.equal(detail.data.pending.length, 1);
  assert.equal(detail.data.proposalChanges.get(proposal.id)!.length, 1);
  assert.equal(detail.data.proposalChanges.get(proposal.id)![0].stale, true);
  const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: createQueryClient() }, createElement(ContactDetailView, { detail })));
  assert.match(html, /Current value: <\/span>Director/);
  assert.match(html, /Stale suggestion/);
  assert.doesNotMatch(html, /Private colleague suggestion/);
  assert.match(html, /href="\/accounts\/a"/);
  assert.match(html, /Source: Meeting · Scope agreed/);
  const withoutParticipation = buildContactDetail(contact, [account], [contact], [deal], [{ ...activity, participants: [colleague.id] }], [proposal], [], now);
  assert.equal(withoutParticipation.data.activities.length, 0);
  assert.match(renderToStaticMarkup(createElement(QueryClientProvider, { client: createQueryClient() }, createElement(ContactDetailView, { detail: withoutParticipation }))), /Source: Meeting · Scope agreed/);
  const partial: Proposal = { ...proposal, status: "PartiallyApproved", changes: [
    { ...proposal.changes[0], status: "Approved" },
    { id: "email-change", entityType: "Contact", entityId: contact.id, field: "email", before: contact.email!, after: "updated@brenlow.example", selected: true, status: "Pending" },
  ] };
  const partialDetail = buildContactDetail(contact, [account], [contact], [deal], [activity], [partial], [], now);
  assert.equal(partialDetail.data.pending.length, 1);
  assert.deepEqual(partialDetail.reviewed[0].changes.map(change => change.id), ["contact-change"]);
});

test("contact repository persists validated data and list queries delegate, share invalidation and avoid SSR storage reads", async (t) => {
  const db = new DealPatchDatabase(`contacts-${randomUUID()}`);
  try {
    const repository = createContactRepository(db);
    const seeded = await repository.getAll();
    assert.equal(seeded.length, 80);
    await db.contacts.update(seeded[0].id, { role: "Regional Director" });
    db.close(); await db.open();
    assert.equal((await repository.getAll()).find(person => person.id === seeded[0].id)?.role, "Regional Director");
    assert.ok((await repository.getByAccountId(seeded[0].accountId)).every(person => person.accountId === seeded[0].accountId));
    await db.contacts.update(seeded[0].id, { status: "Invalid" as Contact["status"] });
    await assert.rejects(repository.getAll());
  } finally { await db.delete(); }
  const read = t.mock.method(contactRepository, "getAll", async () => [contact]);
  const client = createQueryClient();
  const render = (element: ReturnType<typeof createElement>) => renderWithKeyboard(createElement(QueryClientProvider, { client }, element));
  try {
    assert.match(render(createElement(ContactsWorkspace)), /Loading contact data/);
    assert.match(render(createElement(ContactDetailWorkspace, { contactId: contact.id })), /Loading contact data/);
    assert.equal(read.mock.callCount(), 0);
    await client.fetchQuery(contactsQueryOptions);
    assert.equal(read.mock.callCount(), 1);
    await finishReviewWrite(client);
    assert.equal(client.getQueryState(queryKeys.contacts.list)?.isInvalidated, true);
    assert.match(render(createElement(ContactDetailWorkspace, { contactId: "missing" })), /Contact not found/);
    client.setQueryData(queryKeys.accounts.list, [account]); client.setQueryData(queryKeys.deals.list, [deal]); client.setQueryData(queryKeys.activities.list, [activity]); client.setQueryData(queryKeys.proposals.pending, [proposal]);
    assert.match(render(createElement(ContactsWorkspace)), /1 of 1 contacts/);
  } finally { client.clear(); }
});

test("contacts use semantic tables, escaped text, native navigation and recoverable states", () => {
  const rows = buildContactRows([{ ...contact, firstName: "<script>unsafe</script>" }], [account], [], [], []);
  const html = renderWithKeyboard(createElement(ContactsTable, { data: rows }));
  assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /href="\/contacts\/c"/);
  assert.match(html, /href="\/accounts\/a"/);
  assert.match(html, /aria-sort="ascending"/);
  assert.match(html, /data-contact-link="c"/);
  assert.match(renderWithKeyboard(createElement(ContactsTable, { data: [] })), /No contacts yet/);
  assert.match(renderToStaticMarkup(createElement(ContactsQueryState, { failed: true, ready: false, fetching: false, retry: () => {} })), /Unable to load contact data/);
  assert.match(renderToStaticMarkup(createElement(ContactsQueryState, { failed: true, ready: true, fetching: false, retry: () => {} })), /Showing the last loaded values/);
});

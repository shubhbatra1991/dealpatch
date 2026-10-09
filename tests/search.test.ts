import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import accounts from "../data/seed/accounts.json";
import contacts from "../data/seed/contacts.json";
import deals from "../data/seed/deals.json";
import activities from "../data/seed/activities.json";
import proposals from "../data/seed/proposals.json";
import { accountSchema } from "../domain/accounts/schema";
import { contactSchema } from "../domain/contacts/schema";
import { dealSchema } from "../domain/deals/schema";
import { activitySchema } from "../domain/activities/schema";
import { proposalSchema } from "../domain/proposals/schema";
import { buildSearchIndex, searchIndex, searchGroups } from "../features/search/search-index";
import { CommandPalette, SearchResults } from "../features/search/command-palette";
import { allProposalsOptions } from "../features/reviews/use-proposals";
import { PipelineTable } from "../features/pipeline/pipeline-table";
import { ActivityWorkspace } from "../features/activity/activity-workspace";
import { ReviewWorkspace } from "../features/reviews/review-workspace";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { DealPatchDatabase } from "../lib/db/database";
import { createProposalRepository, proposalRepository } from "../lib/repositories/proposals";
import { finishReviewWrite } from "../features/reviews/approval-mutations";
import { renderWithKeyboard } from "./keyboard-provider";

const data = { accounts: accounts.map(record => accountSchema.parse(record)), contacts: contacts.map(record => contactSchema.parse(record)), deals: deals.map(record => dealSchema.parse(record)), activities: activities.map(record => activitySchema.parse(record)), proposals: proposals.map(record => proposalSchema.parse(record)) };
const index = buildSearchIndex(data);

test("search indexes all five entity types and matches case-insensitive partial terms across relevant fields", () => {
  assert.equal(index.length, 335);
  assert.deepEqual(searchIndex(index, "").groups.map(group => group.name), [...searchGroups]);
  const matches = (group: string, id: string, query: string) => assert.ok(searchIndex(index, query, 1000).entries.some(entry => entry.group === group && entry.key === `${group}:${id}`), `${group} ${id} should match ${query}`);
  const account = data.accounts[0];
  for (const value of [account.name, account.industry!, account.region!]) matches("Accounts", account.id, value.slice(0, 5).toUpperCase());
  const person = data.contacts[0];
  for (const value of [person.firstName, person.lastName, person.role!, person.email!, account.name]) matches("Contacts", person.id, value);
  const deal = data.deals[0];
  for (const value of [deal.title, account.name, deal.stage, deal.nextStep!]) matches("Deals", deal.id, value);
  const proposal = data.proposals[0];
  const proposalAccount = data.accounts.find(account => account.id === proposal.accountId)!;
  for (const value of [proposalAccount.name, proposal.changes[0].field, proposal.evidence[0].text]) matches("Reviews", proposal.id, value);
  const activity = data.activities[0];
  const activityAccount = data.accounts.find(account => account.id === activity.accountId)!;
  for (const value of [activity.title, activity.summary.slice(0, 30), activityAccount.name]) matches("Activities", activity.id, value);
  assert.equal(searchIndex(index, "no-such-company-zz").total, 0);
  assert.equal(searchIndex(index, "AVELMERE unrelated-zz").total, 0);
});

test("search caps visible results per group without losing total counts and builds opaque-ID-safe destinations", () => {
  const results = searchIndex(index, "  ");
  assert.equal(results.total, 335);
  assert.equal(results.entries.length, 30);
  assert.ok(results.groups.every(group => group.entries.length === 6));
  assert.deepEqual(searchIndex(index, "", 0).entries, []);
  const id = "opaque/id ?&#";
  const renamed = buildSearchIndex({ accounts: [{ ...data.accounts[0], id }], contacts: [{ ...data.contacts[0], id }], deals: [{ ...data.deals[0], id }], activities: [{ ...data.activities[0], id }], proposals: [{ ...data.proposals[0], id }] });
  const encoded = encodeURIComponent(id);
  assert.deepEqual(renamed.map(entry => entry.href), [`/workspace/accounts/${encoded}`, `/workspace/contacts/${encoded}`, `/workspace/deals/${encoded}`, `/workspace/reviews?proposal=${encoded}`, `/workspace/activity?activity=${encoded}`]);
});

test("index relationships never label foreign account deals as related activity/proposal context", () => {
  const foreign = { ...data.deals[0], id: "foreign", accountId: "other", title: "Foreign private title" };
  const mismatched = buildSearchIndex({ accounts: data.accounts, contacts: [], deals: [foreign], proposals: [{ ...data.proposals[0], dealId: foreign.id, accountId: data.accounts[0].id }], activities: [{ ...data.activities[0], dealId: foreign.id, accountId: data.accounts[0].id }] });
  assert.ok(mismatched.filter(entry => entry.group === "Reviews" || entry.group === "Activities").every(entry => !entry.context.includes(foreign.title) && !entry.text.includes(foreign.title.toLowerCase())));
});

test("proposal search reads validated persisted history, includes reviewed records and shares review invalidation", async (t) => {
  const db = new DealPatchDatabase(`search-${randomUUID()}`);
  try {
    const repository = createProposalRepository(db);
    const original = await repository.getAll();
    assert.equal(original.length, 15);
    await repository.updateStatus(original[0].id, "Rejected");
    db.close(); await db.open();
    assert.equal((await repository.getAll()).find(record => record.id === original[0].id)?.status, "Rejected");
    await db.proposals.update(original[0].id, { confidence: 101 });
    await assert.rejects(repository.getAll());
  } finally { await db.delete(); }
  const read = t.mock.method(proposalRepository, "getAll", async () => data.proposals);
  const client = createQueryClient();
  try {
    assert.deepEqual(await client.fetchQuery(allProposalsOptions), data.proposals);
    assert.equal(read.mock.callCount(), 1);
    await finishReviewWrite(client);
    assert.equal(client.getQueryState(queryKeys.proposals.list)?.isInvalidated, true);
  } finally { client.clear(); }
});

test("palette renders loading/error/empty states, grouped options, escaped text and combobox selection", async (t) => {
  const read = t.mock.method(proposalRepository, "getAll", async () => data.proposals);
  const client = createQueryClient();
  const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(CommandPalette, { onClose: () => {}, navigate: () => {}, restoreFocus: () => {} })));
  try {
    assert.match(render(), /Loading local workspace records/);
    assert.equal(read.mock.callCount(), 0);
    client.setQueryData(queryKeys.accounts.list, data.accounts);
    client.setQueryData(queryKeys.contacts.list, data.contacts);
    client.setQueryData(queryKeys.deals.list, data.deals);
    client.setQueryData(queryKeys.activities.list, data.activities);
    client.setQueryData(queryKeys.proposals.list, data.proposals);
    const html = render();
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-activedescendant=/);
    assert.match(html, /30 shown of 335 matches/);
    for (const group of searchGroups) assert.match(html, new RegExp(`aria-label="${group}, showing`));
    const unsafe = { ...index[0], label: "<script>unsafe</script>", context: "<img onerror=bad>" };
    const markup = renderToStaticMarkup(createElement(SearchResults, { results: searchIndex([unsafe], ""), selectedKey: unsafe.key, onSelect: () => {}, listId: "results" }));
    assert.match(markup, /aria-selected="true"/); assert.match(markup, /&lt;script&gt;/); assert.doesNotMatch(markup, /<script>|<img /);
    for (const key of [queryKeys.accounts.list, queryKeys.contacts.list, queryKeys.deals.list, queryKeys.activities.list, queryKeys.proposals.list]) client.setQueryData(key, []);
    assert.match(render(), /No searchable records/);
    await assert.rejects(client.fetchQuery({ ...allProposalsOptions, staleTime: 0, queryFn: async () => { throw new Error("Unavailable"); } }));
    assert.match(render(), /Results may be incomplete/);
  } finally { client.clear(); }
});

test("search targets open deal details and select account-related activity without starting analysis", () => {
  const target = data.deals[20];
  const html = renderWithKeyboard(createElement(QueryClientProvider, { client: createQueryClient() }, createElement(PipelineTable, { deals: data.deals, accounts: data.accounts, initialDealId: target.id })));
  assert.ok(html.includes(`/workspace/deals/${target.id}`));
  const client = createQueryClient();
  const render = (element: ReturnType<typeof createElement>) => renderWithKeyboard(createElement(QueryClientProvider, { client }, element));
  try {
    client.setQueryData(queryKeys.accounts.list, data.accounts);
    client.setQueryData(queryKeys.deals.list, data.deals);
    client.setQueryData(queryKeys.activities.list, data.activities);
    const activity = data.activities[20];
    client.setQueryData(queryKeys.contacts.list, data.contacts);
    assert.match(render(createElement(ActivityWorkspace, { targetActivityId: activity.id })), new RegExp(`<h3[^>]*>${activity.title}`));
    assert.match(render(createElement(ActivityWorkspace, { targetActivityId: "missing" })), /selected activity is no longer/);
    client.setQueryData(queryKeys.proposals.queue, []);
    client.setQueryData(queryKeys.proposals.list, [{ ...data.proposals[0], status: "Approved" }]);
    client.setQueryData(queryKeys.proposals.reviewItems, [{ proposal: { ...data.proposals[0], status: "Approved" }, account: data.accounts[0].name, changes: data.proposals[0].changes.map(change => ({ change: { ...change, status: "Approved" }, current: change.after, target: change.entityId, conflict: false })) }]);
    assert.match(render(createElement(ReviewWorkspace, { targetProposalId: data.proposals[0].id })), /Approval complete/);
    assert.match(render(createElement(ReviewWorkspace, { targetProposalId: "missing" })), /selected proposal is no longer/);
  } finally { client.clear(); }
});


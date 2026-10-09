import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { loadSeedData } from "../lib/db/seed";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import type { AuditEvent } from "../domain/audit/audit.types";
import type { Proposal } from "../domain/proposals/proposal";
import { buildDealDetail, dealHref, dealTabs } from "../features/deals/deal-detail-model";
import { DealDetailWorkspace } from "../features/deals/deal-detail-workspace";
import { DealTabContent } from "../features/deals/deal-sections";
import { PipelineTable } from "../features/pipeline/pipeline-table";
import { buildSearchIndex } from "../features/search/search-index";
import { resolveFavorites } from "../features/favorites/favorites-model";
import { dealsQueryOptions } from "../features/pipeline/use-deals";
import { dealRepository } from "../lib/repositories/deals";
import Page from "../app/workspace/deals/[dealId]/page";
import { renderWithKeyboard } from "./keyboard-provider";

const seed = loadSeedData();
const deal = seed.deals[0];
const now = new Date("2026-10-08T12:00:00Z");
const project = (events: AuditEvent[] = [], proposals = seed.proposals) => buildDealDetail(deal, seed.accounts, seed.contacts, seed.deals, seed.activities, proposals, events, now);

test("deal detail joins only its account, activity participants and opportunity-related reviews", () => {
  const detail = project();
  assert.equal(detail.account?.id, deal.accountId);
  assert.ok(detail.activities.length > 0);
  assert.ok(detail.activities.every(activity => activity.dealId === deal.id && activity.accountId === deal.accountId));
  assert.ok(detail.activities.every((activity, index) => !index || Date.parse(detail.activities[index - 1].occurredAt) >= Date.parse(activity.occurredAt)));
  const ids = new Set(detail.activities.flatMap(activity => activity.participants ?? []));
  assert.ok(detail.contacts.length > 0);
  assert.ok(detail.contacts.every(contact => ids.has(contact.id) && contact.accountId === deal.accountId));
  assert.ok(detail.contacts.every(contact => contact.lastRelatedActivityAt === detail.activities.find(activity => activity.participants?.includes(contact.id))?.occurredAt));
  assert.ok(detail.pending.every(proposal => proposal.accountId === deal.accountId && (proposal.dealId === deal.id || proposal.changes.some(change => change.entityType === "Deal" && change.entityId === deal.id))));
  const foreign = seed.contacts.find(contact => contact.accountId !== deal.accountId)!;
  const malformed = buildDealDetail(deal, seed.accounts, seed.contacts, seed.deals, [{ ...seed.activities[0], accountId: "other", dealId: deal.id }, { ...seed.activities[0], accountId: deal.accountId, dealId: deal.id, participants: [foreign.id] }], seed.proposals, [], now);
  assert.equal(malformed.activities.length, 1);
  assert.equal(malformed.contacts.length, 0);
  assert.equal(malformed.activities[0].participantLabels[0].available, false);
});

test("deal audit filters direct fields and related proposal decisions, retaining approval and undo", () => {
  const proposal: Proposal = { ...seed.proposals[0], accountId: deal.accountId, dealId: deal.id };
  const event = (id: string, entityType: string, entityId: string, action: AuditEvent["action"] = "ProposalApproved"): AuditEvent => ({ id, entityType, entityId, action, proposalId: proposal.id, previousValue: { stage: "Discovery" }, nextValue: { stage: "Evaluation" }, occurredAt: "2026-10-08T10:00:00Z" });
  const events = [event("approve", "Deal", deal.id), { ...event("undo", "Deal", deal.id, "ApprovalUndone"), occurredAt: "2026-10-08T11:00:00Z" }, event("decision", "Proposal", proposal.id), event("sibling", "Deal", "other-deal"), event("contact", "Contact", seed.contacts[0].id), event("foreign", "Proposal", "other-proposal")];
  const detail = project(events, [proposal]);
  assert.deepEqual(new Set(detail.auditEvents.map(event => event.id)), new Set(["approve", "undo", "decision"]));
  assert.equal(detail.auditEvents[0].action, "ApprovalUndone");
  const html = renderWithKeyboard(createElement(DealTabContent, { detail, tab: "Changes" }));
  assert.match(html, /Approval undone/); assert.match(html, /Proposal approved/);
  assert.match(html, /Previous value/); assert.match(html, /Next value/);
  assert.ok(html.includes(`/workspace/reviews?proposal=${proposal.id}`));
});

test("deal health uses UTC calendar days, live related activity and open-deal thresholds", () => {
  const target = { ...deal, stage: "Evaluation" as const, risk: "Medium" as const, expectedCloseDate: "2026-10-01", nextStep: "  ", probability: 20, lastActivityAt: "2026-09-01T10:00:00Z" };
  const detail = buildDealDetail(target, seed.accounts, [], [target], [], [], [], now);
  assert.equal(detail.daysUntilClose, -7);
  assert.equal(detail.closeTiming, "7 days overdue");
  for (const text of ["Medium risk", "Stale activity", "Overdue expected close date", "No next step defined", "Low probability"]) assert.ok(detail.signals.some(signal => signal.includes(text)), text);
  const refreshed = buildDealDetail(target, seed.accounts, [], [target], [{ ...seed.activities[0], dealId: target.id, accountId: target.accountId, occurredAt: now.toISOString() }], [], [], now);
  assert.equal(refreshed.lastActivityAt, now.toISOString());
  assert.ok(!refreshed.signals.some(signal => signal.includes("Stale")));
  const closed = buildDealDetail({ ...target, stage: "ClosedWon" }, seed.accounts, [], [], [], [], [], now);
  assert.equal(closed.closeTiming, "Closed opportunity");
  assert.deepEqual(closed.signals, ["Medium risk"]);
  const due = buildDealDetail({ ...target, expectedCloseDate: "2026-10-08" }, [], [], [], [], [], [], now);
  assert.equal(due.closeTiming, "Due today");
});

test("all deal tabs render scoped sources, review diffs and meaningful empty states", () => {
  const detail = project();
  for (const tab of dealTabs) {
    const html = renderWithKeyboard(createElement(DealTabContent, { detail, tab }));
    assert.match(html, /<section/);
    assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
  }
  const activity = renderWithKeyboard(createElement(DealTabContent, { detail, tab: "Activity" }));
  assert.ok(activity.includes(`/workspace/activity?activity=${detail.activities[0].id}`));
  const people = renderWithKeyboard(createElement(DealTabContent, { detail, tab: "Contacts" }));
  assert.match(people, /Inferred from participation/);
  assert.ok(people.includes(`/workspace/contacts/${detail.contacts[0].id}`));
  const reviews = renderWithKeyboard(createElement(DealTabContent, { detail, tab: "Reviews" }));
  assert.match(reviews, /Current value:/); assert.match(reviews, /Original captured value:/); assert.match(reviews, /Evidence:/); assert.match(reviews, /Open in Review Queue/);
  const empty = buildDealDetail({ ...deal, nextStep: undefined }, [], [], [], [], [], [], now);
  for (const [tab, message] of [["Activity", "No activity recorded"], ["Contacts", "No contacts linked"], ["Reviews", "No proposals recorded"], ["Changes", "No audit events recorded"], ["Overview", "No pending reviews"]] as const) assert.ok(renderWithKeyboard(createElement(DealTabContent, { detail: empty, tab })).includes(message));
});

test("route and query states remain SSR-safe, recover from errors and derive from shared caches", async t => {
  const client = createQueryClient();
  const read = t.mock.method(dealRepository, "getAll", async () => seed.deals);
  const render = (id: string) => renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(DealDetailWorkspace, { dealId: id })));
  try {
    const page = await Page({ params: Promise.resolve({ dealId: deal.id }) });
    assert.equal(page.type, DealDetailWorkspace); assert.equal(page.props.dealId, deal.id);
    assert.match(render(deal.id), /Loading deal data/); assert.equal(read.mock.callCount(), 0);
    client.setQueryData(queryKeys.deals.list, seed.deals);
    assert.match(render("missing-deal"), /Deal not found/);
    client.setQueryData(queryKeys.accounts.list, seed.accounts);
    client.setQueryData(queryKeys.contacts.list, seed.contacts);
    client.setQueryData(queryKeys.activities.list, seed.activities);
    client.setQueryData(queryKeys.proposals.forAccount(deal.accountId), seed.proposals);
    client.setQueryData(queryKeys.audit.forAccount(deal.accountId), []);
    client.setQueryData(queryKeys.favorites.list, []);
    const html = render(deal.id);
    assert.match(html, /aria-label="Deal summary"/); assert.match(html, /aria-label="Add .* to favorites"/);
    for (const tab of dealTabs) assert.ok(html.includes(`id="deal-tab-${tab}"`));
    assert.ok(html.includes(`/workspace/accounts/${deal.accountId}`));
    client.setQueryData(queryKeys.deals.list, [{ ...deal, title: "<script>escaped</script>", nextStep: "Updated from shared cache" }]);
    assert.match(render(deal.id), /&lt;script&gt;escaped/); assert.match(render(deal.id), /Updated from shared cache/);
    await assert.rejects(client.fetchQuery({ ...dealsQueryOptions, staleTime: 0, queryFn: async () => { throw new Error("Storage unavailable"); } }));
    assert.match(render(deal.id), /Unable to refresh deal data/);
    const other = await Page({ params: Promise.resolve({ dealId: "missing-deal" }) });
    assert.equal(other.props.dealId, "missing-deal");
  } finally { client.clear(); }
});

test("Pipeline links, search and favorites all resolve opaque deal IDs to the dedicated route", () => {
  const id = "opaque/id ?&#";
  assert.equal(dealHref(id), `/workspace/deals/${encodeURIComponent(id)}`);
  const index = buildSearchIndex(seed);
  assert.equal(index.find(entry => entry.key === `Deals:${deal.id}`)?.href, dealHref(deal.id));
  const favorites = resolveFavorites([{ id: "favorite", entityType: "deal", entityId: deal.id, createdAt: now.toISOString() }], seed.accounts, seed.contacts, seed.deals);
  assert.equal(favorites[0].href, dealHref(deal.id));
  const client = createQueryClient();
  try {
    const html = renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(PipelineTable, { deals: seed.deals, accounts: seed.accounts, initialDealId: deal.id })));
    assert.ok(html.includes(`href="${dealHref(deal.id)}"`));
    assert.match(html, />Open deal<\/a>/); assert.match(html, /Enter opens a highlighted deal/);
    assert.doesNotMatch(html, /Opportunity preview/);
    assert.match(html, /aria-label="Select all matching deals"/);
  } finally { client.clear(); }
});

import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClientProvider } from "@tanstack/react-query";
import type { Deal } from "../domain/deals/deal";
import type { Activity } from "../domain/activities/activity";
import type { Proposal } from "../domain/proposals/proposal";
import { buildOverview } from "../features/overview/overview-model";
import { OverviewWorkspace } from "../features/overview/overview-workspace";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { dealRepository } from "../lib/repositories/deals";
import { dealsQueryOptions } from "../features/pipeline/use-deals";

const now = new Date("2026-10-08T12:00:00Z");
const base: Deal = { id: "deal", accountId: "account", title: "Regional rollout", stage: "Discovery", value: 100, currency: "EUR", probability: 30, ownerId: "owner", risk: "Low", nextStep: "Confirm requirements", lastActivityAt: "2026-10-08T08:00:00Z" };
const activity: Activity = { id: "activity", accountId: "account", dealId: "deal", type: "Meeting", title: "Sponsor call", summary: "Confirmed scope", occurredAt: "2026-10-08T11:00:00Z" };
const proposal: Proposal = { id: "proposal", accountId: "account", dealId: "deal", sourceActivityId: "activity", status: "Pending", confidence: 90, createdAt: now.toISOString(), evidence: [{ type: "activity_excerpt", sourceActivityId: "activity", text: "Confirmed scope" }], changes: [{ id: "change", entityType: "Deal", entityId: "deal", field: "stage", before: "Discovery", after: "Evaluation", selected: true, status: "Pending" }] };

test("dashboard derives open stages, risk and per-currency totals without mutating inputs", () => {
  const deals: Deal[] = [base, { ...base, id: "second", stage: "Negotiation", currency: "USD", value: 200, risk: "High" }, { ...base, id: "third", stage: "Evaluation", value: 50, risk: "Medium" }, { ...base, id: "closed", stage: "ClosedWon", value: 5000 }];
  const original = structuredClone(deals);
  const data = buildOverview(deals, [], [], [], now);
  assert.equal(data.openDeals, 3);
  assert.equal(data.atRisk, 2);
  assert.deepEqual(data.currencies, [{ currency: "EUR", value: 150 }, { currency: "USD", value: 200 }]);
  assert.deepEqual(data.stages.map(item => item.count), [1, 1, 0, 1]);
  assert.deepEqual(deals, original);
});

test("attention uses UTC close dates, latest deal activity, whitespace next steps and exact stale boundary", () => {
  const deals: Deal[] = [
    { ...base, expectedCloseDate: "2026-10-08", lastActivityAt: "2026-09-01T00:00:00Z" },
    { ...base, id: "boundary", expectedCloseDate: "2026-10-07", lastActivityAt: "2026-09-24T12:00:00Z", risk: "High", nextStep: "   " },
    { ...base, id: "never", lastActivityAt: undefined },
    { ...base, id: "closed", stage: "ClosedLost", expectedCloseDate: "2026-01-01", nextStep: undefined },
  ];
  const data = buildOverview(deals, [], [activity, { ...activity, id: "account-only", dealId: undefined }], [], now);
  assert.deepEqual(data.counts, { overdue: 1, missingNextStep: 1, stale: 2, highRisk: 1 });
  assert.equal(data.attention[0].deal.id, "boundary");
  assert.equal(data.attention.some(item => item.deal.id === "deal"), false);
  assert.equal(data.health, 67); // 100 - 25 * (1/3 + 1/3 + 2/3).
});

test("review counts include only remaining changes, overlap types, and never equate confidence with approval", () => {
  const mixed: Proposal = { ...proposal, status: "PartiallyApproved", changes: [
    { ...proposal.changes[0], status: "Approved" },
    { id: "contact", entityType: "Contact", entityId: "person", field: "role", before: "Manager", after: "Director", selected: false, status: "Edited" },
  ] };
  const data = buildOverview([base], [], [], [proposal, { ...mixed, id: "mixed" }, { ...proposal, id: "done", status: "Approved" }, { ...proposal, id: "resolved", changes: [{ ...proposal.changes[0], status: "Rejected" }] }], now);
  assert.deepEqual(data.reviews, { pending: 2, dealUpdates: 1, contactUpdates: 1, highConfidence: 2 });
  assert.equal(data.health, 75); // Review factor is capped even when reviews exceed open deals.
  assert.ok(data.suggestions[0].text.includes("Review 2"));
  assert.ok(data.suggestions.length >= 3 && data.suggestions.length <= 5);
  assert.equal(mixed.changes[1].before, "Manager");
});

test("health stays within 0–100, empty data is useful, recent activity is chronological and bounded", () => {
  const empty = buildOverview([], [], [], [], now);
  assert.equal(empty.health, 100);
  assert.deepEqual(empty.currencies, []);
  assert.equal(empty.suggestions.length, 3);
  const unhealthy = buildOverview([{ ...base, expectedCloseDate: "2026-01-01", nextStep: undefined, lastActivityAt: undefined }], [], [], [proposal], now);
  assert.equal(unhealthy.health, 0);
  const activities = Array.from({ length: 8 }, (_, i) => ({ ...activity, id: String(i), occurredAt: `2026-10-0${i + 1}T08:00:00Z` }));
  const original = structuredClone(activities);
  assert.deepEqual(buildOverview([], [], activities, [], now).recent.map(item => item.id), ["7", "6", "5", "4", "3"]);
  assert.deepEqual(activities, original);
});

test("Overview renders loading/error states safely during SSR and reflects existing query cache changes", async (t) => {
  const read = t.mock.method(dealRepository, "getAll", async () => { throw new Error("Storage blocked"); });
  const client = createQueryClient();
  const render = () => renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(OverviewWorkspace)));
  try {
    assert.match(render(), /Loading local workspace signals/);
    assert.equal(read.mock.callCount(), 0);
    await assert.rejects(client.fetchQuery(dealsQueryOptions), /Storage blocked/);
    assert.match(render(), /Unable to load the dashboard/);
    client.setQueryData(queryKeys.deals.list, [base]);
    client.setQueryData(queryKeys.accounts.list, []);
    client.setQueryData(queryKeys.activities.list, [{ ...activity, title: "<script>unsafe</script>" }]);
    client.setQueryData(queryKeys.proposals.pending, [proposal]);
    const html = render();
    for (const heading of ["Workspace Health", "Pipeline Stage Summary", "Review Queue Summary", "Needs Attention", "Suggested Actions", "Recent Activity"]) assert.ok(html.includes(heading));
    assert.match(html, /aria-label="Workspace health score"/);
    assert.match(html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
    assert.match(html, /Review 1 high-confidence proposal/);
    client.setQueryData(queryKeys.proposals.pending, []);
    client.setQueryData(queryKeys.deals.list, [{ ...base, stage: "ClosedWon" }]);
    assert.doesNotMatch(render(), /Review 1 high-confidence proposal/);
    assert.match(render(), /No open deals need attention/);
  } finally { client.clear(); }
});

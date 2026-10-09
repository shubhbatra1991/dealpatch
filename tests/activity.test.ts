import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { loadSeedData } from "../lib/db/seed";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { buildActivityRows, filterActivityRows, adjacentActivityId, activityParticipants } from "../features/activity/activity-model";
import { ActivityFeed } from "../features/activity/activity-feed";
import { ActivityWorkspace } from "../features/activity/activity-workspace";
import { AgentPanel } from "../features/activity/agent-panel";
import { useDemoAnalysis } from "../features/activity/use-demo-analysis";
import type { AnalysisState } from "../features/activity/analysis-state";
import { createMockIntelligenceProvider } from "../lib/simulation/mock-intelligence-provider";
import type { IntelligenceEvent } from "../lib/simulation/intelligence-provider";
import { renderWithKeyboard } from "./keyboard-provider";

const seed = loadSeedData();
const rows = buildActivityRows(seed.activities, seed.accounts, seed.deals);
const emptyFilters = { search: "", type: "" as const, accountId: "" };

test("activity feed sorts newest-first without mutating source and combines partial search with exact filters", () => {
  const before = structuredClone(seed.activities);
  assert.equal(rows.length, 150);
  assert.deepEqual(seed.activities, before);
  assert.ok(rows.every((row, index) => !index || Date.parse(rows[index - 1].activity.occurredAt) >= Date.parse(row.activity.occurredAt)));
  const target = rows.find(row => row.activity.type === "Meeting")!;
  const matches = filterActivityRows(rows, { search: `  ${target.account!.name.toUpperCase()}  `, type: "Meeting", accountId: target.activity.accountId });
  assert.ok(matches.length > 0);
  assert.ok(matches.every(row => row.activity.type === "Meeting" && row.activity.accountId === target.activity.accountId));
  assert.equal(filterActivityRows(matches, { ...emptyFilters, type: "Note" }).length, 0);
  assert.ok(filterActivityRows(rows, { ...emptyFilters, search: target.deal!.title.slice(0, 15).toLowerCase() }).some(row => row.activity.id === target.activity.id));
  assert.equal(filterActivityRows(rows, { ...emptyFilters, search: "unmatched-search-phrase" }).length, 0);
  const offset = buildActivityRows([{ ...target.activity, id: "earlier", occurredAt: "2026-10-08T12:00:00+02:00" }, { ...target.activity, id: "later", occurredAt: "2026-10-08T11:00:00Z" }], seed.accounts, seed.deals);
  assert.equal(offset[0].activity.id, "later");
});

test("activity relationships never label a foreign deal or contact as part of this source", () => {
  const activity = seed.activities.find(activity => activity.participants?.length)!;
  const foreign = seed.contacts.find(contact => contact.accountId !== activity.accountId)!;
  const related = buildActivityRows([{ ...activity, dealId: "foreign" }], [], [{ ...seed.deals[0], id: "foreign", accountId: "different" }])[0];
  assert.equal(related.account, undefined);
  assert.equal(related.deal, undefined);
  const people = activityParticipants({ ...activity, participants: [activity.participants![0], foreign.id, "missing"] }, seed.contacts);
  assert.equal(people[0].available, true);
  assert.equal(people[1].available, false);
  assert.equal(people[2].name, "Unavailable contact (missing)");
});

test("keyboard movement follows filtered order, clamps at boundaries and handles no selection", () => {
  const filtered = rows.slice(0, 3);
  assert.equal(adjacentActivityId(filtered, "", 1), filtered[0].activity.id);
  assert.equal(adjacentActivityId(filtered, "", -1), filtered[2].activity.id);
  assert.equal(adjacentActivityId(filtered, filtered[0].activity.id, -1), filtered[0].activity.id);
  assert.equal(adjacentActivityId(filtered, filtered[0].activity.id, 1), filtered[1].activity.id);
  assert.equal(adjacentActivityId(filtered, filtered[2].activity.id, 1), filtered[2].activity.id);
  assert.equal(adjacentActivityId([], "missing", 1), undefined);
});

test("150+ activities render as semantic feed buttons with one tab stop, selected state and escaped source text", () => {
  const expanded = [...rows, { ...rows[0], activity: { ...rows[0].activity, id: "extra", title: "<script>source</script>" } }];
  const html = renderWithKeyboard(createElement(ActivityFeed, { rows: expanded, selectedId: rows[5].activity.id, onSelect: () => {}, onOpen: () => {} }));
  assert.equal((html.match(/data-activity-id=/g) ?? []).length, 151);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 1);
  assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
  assert.match(html, /&lt;script&gt;source&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /aria-label="Activity feed"/);
});

test("workspace has newest default selection, loading, empty, missing and storage-error states without starting analysis", async () => {
  const client = createQueryClient();
  const render = (targetActivityId?: string) => renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(ActivityWorkspace, { targetActivityId })));
  try {
    assert.match(render(), /Loading local activities/);
    client.setQueryData(queryKeys.activities.list, seed.activities);
    client.setQueryData(queryKeys.accounts.list, seed.accounts);
    client.setQueryData(queryKeys.contacts.list, seed.contacts);
    client.setQueryData(queryKeys.deals.list, seed.deals);
    client.setQueryData(queryKeys.proposals.list, seed.proposals);
    const html = render();
    assert.match(html, new RegExp(`data-activity-id="${rows[0].activity.id}"[^>]*aria-current="true"`));
    assert.ok(html.includes(rows[0].activity.title));
    assert.match(html, /Waiting \u00b7 Ready to analyze/);
    assert.match(html, /150 of 150 activities/);
    assert.doesNotMatch(html, /Choose activity|Draft proposal ready/);
    const selected = render("activity_003");
    assert.match(selected, /Waiting · Ready to analyze/);
    assert.match(selected, /Run simulated analysis/);
    assert.match(selected, /href="\/contacts\//);
    assert.match(selected, /href="\/deals\//);
    assert.match(selected, /Already in Review Queue/);
    assert.match(selected, /href="\/reviews\?proposal=proposal_001"/);
    assert.match(render("missing"), /selected activity is no longer/);
    client.setQueryData(queryKeys.activities.list, []);
    assert.match(render(), /No activities yet/);
    await assert.rejects(client.fetchQuery({ queryKey: queryKeys.activities.list, queryFn: async () => { throw new Error("Unavailable"); }, staleTime: 0 }));
    assert.match(render(), /Unable to refresh local activity data/);
  } finally { client.clear(); }
});

function AnalysisHarness({ state, sourceId }: { state: AnalysisState; sourceId?: string }) {
  const analysis = useDemoAnalysis(undefined, sourceId);
  const generated = state.events.find(event => event.type === "proposal_generated");
  return createElement(AgentPanel, { row: rows.find(row => row.activity.id === "activity_003"), analysis: { ...analysis, state, proposal: state.status === "completed" && generated?.type === "proposal_generated" ? generated.proposal : undefined } });
}

test("analysis panel renders running, failed and completed drafts with confidence, evidence and explicit queue action", async () => {
  const activity = seed.activities.find(activity => activity.id === "activity_003")!;
  const events: IntelligenceEvent[] = [];
  const provider = createMockIntelligenceProvider({ stepDelayMs: 0 });
  for await (const event of provider.analyze({ activity, accounts: seed.accounts, deals: seed.deals })) events.push(event);
  const client = createQueryClient();
  const render = (state: AnalysisState) => renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(AnalysisHarness, { state })));
  try {
    assert.match(render({ status: "running", events: events.slice(0, 2) }), /Running · Match account/);
    const failed = render({ status: "error", events: events.slice(0, 2), error: "Demo failure" });
    assert.match(failed, /Failed · Analysis failed/);
    assert.match(failed, /Demo failure/);
    assert.equal((failed.match(/>Failed<\/span>/g) ?? []).length, 1);
    assert.equal((failed.match(/>Complete<\/span>/g) ?? []).length, 2);
    assert.equal((failed.match(/>Waiting<\/span>/g) ?? []).length, 4);
    assert.doesNotMatch(failed, /Send to Review Queue/);
    for (let index = 0; index < events.length; index++) {
      const progressing = render({ status: "running", events: events.slice(0, index) });
      assert.equal((progressing.match(/aria-current="step"/g) ?? []).length, 1);
      assert.equal((progressing.match(/>Complete<\/span>/g) ?? []).length, index);
      assert.equal((progressing.match(/>Running<\/span>/g) ?? []).length, 1);
      const failure = render({ status: "error", events: events.slice(0, index), error: "Stage failed" });
      assert.equal((failure.match(/>Failed<\/span>/g) ?? []).length, 1);
      assert.equal((failure.match(/>Complete<\/span>/g) ?? []).length, index);
    }
    const completed = render({ status: "completed", events });
    for (const text of ["Complete · Analysis complete", "Generated proposal", "demo confidence", "Source evidence", "Current value:", "Proposed value:", "Send to Review Queue"]) assert.ok(completed.includes(text), text);
    assert.match(completed, /href="\/accounts\/account_001"/);
    assert.match(completed, /href="\/deals\//);
    client.setQueryData(queryKeys.proposals.list, seed.proposals);
    const existing = renderWithKeyboard(createElement(QueryClientProvider, { client }, createElement(AnalysisHarness, { state: { status: "idle", events: [] }, sourceId: activity.id })));
    assert.match(existing, /Already in Review Queue/);
    assert.match(existing, /href="\/reviews\?proposal=proposal_001"/);
    assert.doesNotMatch(render({ status: "cancelled", events: events.slice(0, 5) }), /Send to Review Queue/);
  } finally { client.clear(); }
});

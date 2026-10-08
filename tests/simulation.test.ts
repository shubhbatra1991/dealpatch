import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderWithKeyboard as renderToStaticMarkup } from "./keyboard-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMockIntelligenceProvider } from "../lib/simulation/mock-intelligence-provider";
import type { IntelligenceEvent, IntelligenceInput } from "../lib/simulation/intelligence-provider";
import { loadSeedData } from "../lib/db/seed";
import { proposalSchema } from "../domain/proposals/schema";
import { DealPatchDatabase } from "../lib/db/database";
import { createProposalRepository } from "../lib/repositories/proposals";
import { createActivityRepository } from "../lib/repositories/activities";
import { analysisReducer, idleAnalysis } from "../features/activity/analysis-state";
import { ActivityWorkspace } from "../features/activity/activity-workspace";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";

const seed = loadSeedData();
const provider = createMockIntelligenceProvider({ stepDelayMs: 0, now: () => "2026-10-08T12:00:00.000Z", createId: () => "test-run" });
function input(id = "activity_003"): IntelligenceInput {
  return { activity: seed.activities.find(activity => activity.id === id)!, accounts: seed.accounts, deals: seed.deals };
}
async function collect(request: IntelligenceInput, signal?: AbortSignal) {
  const events: IntelligenceEvent[] = [];
  for await (const event of provider.analyze(request, { signal })) events.push(event);
  return events;
}
async function draft(id = "activity_003") {
  const event = (await collect(input(id))).at(-1)!;
  assert.equal(event.type, "proposal_generated");
  if (event.type !== "proposal_generated") throw new Error("Expected a draft");
  return event.proposal;
}

test("the local provider emits ordered, progressively useful events and a schema-valid pending proposal", async () => {
  const request = input();
  const before = structuredClone(request);
  const events = await collect(request);
  assert.equal(provider.label, "Demo intelligence");
  assert.deepEqual(events.map(event => event.type), ["activity_received", "extracting_entities", "matching_account", "matching_deal", "detecting_changes", "evaluating_confidence", "proposal_generated"]);
  assert.deepEqual(events.map(event => event.sequence), [1,2,3,4,5,6,7]);
  assert.ok(events.every(event => event.at === "2026-10-08T12:00:00.000Z"));
  assert.deepEqual(events[1].type === "extracting_entities" && events[1].signals, ["evaluation"]);
  const proposal = await draft();
  assert.deepEqual(proposalSchema.parse(proposal), proposal);
  assert.equal(proposal.status, "Pending");
  assert.equal(proposal.sourceActivityId, request.activity.id);
  assert.equal(proposal.changes[0].before, "Discovery");
  assert.equal(proposal.changes[0].after, "Evaluation");
  assert.ok(proposal.evidence.every(evidence => request.activity.summary.includes(evidence.text)));
  assert.deepEqual(request, before);
});

test("supported close-date, next-step and budget rules generate real field diffs", async () => {
  for (const [id, fields] of [
    ["activity_005", ["expectedCloseDate"]], ["activity_008", ["nextStep"]], ["activity_010", ["probability"]],
  ] as const) {
    const proposal = await draft(id);
    assert.deepEqual(proposal.changes.map(change => change.field), [...fields]);
    assert.ok(proposal.changes.every(change => change.before !== change.after));
  }
  const budget = input("activity_010");
  const events = await collect({ ...budget, deals: budget.deals.map(deal => deal.id === budget.activity.dealId ? { ...deal, risk: "Low" } : deal) });
  const result = events.at(-1)!;
  assert.deepEqual(result.type === "proposal_generated" && result.proposal.changes.map(change => change.field), ["risk", "probability"]);
});

test("unsupported text, unmatched relationships, unchanged values and closed deals never fabricate proposals", async () => {
  const normal = input();
  const requests: IntelligenceInput[] = [
    input("activity_001"), { ...normal, accounts: [] },
    { ...normal, deals: normal.deals.map(deal => deal.id === normal.activity.dealId ? { ...deal, accountId: "another-account" } : deal) },
    { ...normal, deals: normal.deals.map(deal => deal.id === normal.activity.dealId ? { ...deal, stage: "Evaluation", probability: 45 } : deal) },
    { ...normal, deals: normal.deals.map(deal => deal.id === normal.activity.dealId ? { ...deal, stage: "ClosedWon" } : deal) },
  ];
  for (const request of requests) {
    const events = await collect(request);
    assert.equal(events.at(-1)!.type, "analysis_completed");
    assert.ok(!events.some(event => event.type === "proposal_generated"));
    assert.equal(events.find(event => event.type === "evaluating_confidence")?.confidence, 0);
  }
});

test("streams deliver the first event independently and AbortSignal stops a pending stage", async () => {
  const delayed = createMockIntelligenceProvider({ stepDelayMs: 10_000 });
  const controller = new AbortController();
  const stream = delayed.analyze(input(), { signal: controller.signal })[Symbol.asyncIterator]();
  assert.equal((await stream.next()).value.type, "activity_received");
  const next = stream.next();
  const rejected = assert.rejects(next, error => error instanceof DOMException && error.name === "AbortError");
  controller.abort();
  await rejected;
  assert.equal((await stream.next()).done, true);
  await assert.rejects(collect(input(), controller.signal), error => error instanceof DOMException && error.name === "AbortError");
});

test("invalid input and invalid timing fail cleanly", async () => {
  assert.throws(() => createMockIntelligenceProvider({ stepDelayMs: -1 }), /non-negative/);
  await assert.rejects(collect({ ...input(), activity: { ...input().activity, summary: "" } }));
});

test("partial UI state retains events on cancel/failure and ignores late events until restart", async () => {
  const event = (await collect(input()))[0];
  let state = analysisReducer(idleAnalysis, { type: "start" });
  state = analysisReducer(state, { type: "event", event });
  assert.equal(state.status, "running");
  assert.equal(state.events.length, 1);
  state = analysisReducer(state, { type: "cancel" });
  assert.equal(state.status, "cancelled");
  assert.equal(analysisReducer(state, { type: "event", event }).events.length, 1);
  state = analysisReducer(state, { type: "start" });
  assert.equal(state.events.length, 0);
  state = analysisReducer(state, { type: "event", event });
  state = analysisReducer(state, { type: "error", error: "Demo failure" });
  assert.equal(state.error, "Demo failure");
  assert.equal(state.events.length, 1);
  assert.deepEqual(analysisReducer(state, { type: "reset" }), idleAnalysis);
});

test("queueing is explicit, deduplicates pending proposals and never applies CRM changes", async () => {
  const db = new DealPatchDatabase(`simulation-test-${randomUUID()}`);
  try {
    const activities = await createActivityRepository(db).getAll();
    assert.equal(activities.length, 150);
    assert.deepEqual(activities.map(activity => activity.occurredAt), activities.map(activity => activity.occurredAt).sort().reverse());
    const repo = createProposalRepository(db);
    const dealsBefore = await db.deals.toArray();
    const generated = await draft();
    assert.equal((await db.proposals.toArray()).length, 15);
    const existing = await repo.queueGenerated(generated);
    assert.equal(existing.created, false);
    assert.equal(existing.proposal.id, "proposal_001");
    const additionalSource = { ...input().activity, id: "activity_demo" };
    await db.activities.add(additionalSource);
    const event = (await collect({ ...input(), activity: additionalSource })).at(-1)!;
    if (event.type !== "proposal_generated") throw new Error("Expected a new draft");
    const created = await repo.queueGenerated(event.proposal);
    assert.equal(created.created, true);
    assert.equal((await repo.getPending()).length, 16);
    assert.equal((await repo.queueGenerated(created.proposal)).created, false);
    assert.deepEqual(await db.deals.toArray(), dealsBefore);
    const reopened = new DealPatchDatabase(db.name);
    try { assert.equal((await reopened.proposals.get(created.proposal.id))!.status, "Pending"); } finally { reopened.close(); }
  } finally { await db.delete(); }
});

test("stale sources, changed values and foreign relationships cannot queue drafts", async () => {
  const db = new DealPatchDatabase(`simulation-invalid-test-${randomUUID()}`);
  try {
    const repo = createProposalRepository(db);
    await repo.getPending();
    const generated = await draft();
    const source = input().activity;
    await db.activities.update(source.id, { summary: "Updated source" });
    await assert.rejects(repo.queueGenerated(generated), /source activity changed/);
    await db.activities.put(source);
    await db.deals.update(generated.dealId!, { stage: "Proposal" });
    await assert.rejects(repo.queueGenerated(generated), /current deal value changed/);
    await db.deals.update(generated.dealId!, { accountId: "account_002" });
    await assert.rejects(repo.queueGenerated(generated), /activity, account or deal changed/);
    assert.equal((await db.proposals.toArray()).length, 15);
  } finally { await db.delete(); }
});

test("Activity SSR renders demo labels and native controls without starting analysis or storage reads", () => {
  const client = createQueryClient();
  try {
    client.setQueryData(queryKeys.activities.list, seed.activities);
    client.setQueryData(queryKeys.accounts.list, seed.accounts);
    client.setQueryData(queryKeys.deals.list, seed.deals);
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(ActivityWorkspace)));
    for (const text of ["Demo intelligence", "No real LLM or external AI API", "Run simulated analysis", "Choose activity", "Simulated analysis events", "Ready to analyze"]) assert.ok(html.includes(text), text);
    assert.ok(!html.includes("Draft proposal ready"));
  } finally { client.clear(); }
});

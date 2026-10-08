import assert from "node:assert/strict";
import test from "node:test";
import accounts from "../data/seed/accounts.json";
import contacts from "../data/seed/contacts.json";
import deals from "../data/seed/deals.json";
import activities from "../data/seed/activities.json";
import proposals from "../data/seed/proposals.json";
import { seedDataSchema } from "../data/seed/validate";
import { proposalChangeSchema } from "../domain/proposals/schema";

const seed = { accounts, contacts, deals, activities, proposals };

test("seed counts, stages, risks, activity types and proposal scenarios are covered", () => {
  const data = seedDataSchema.parse(seed);
  assert.deepEqual(Object.values(data).map((records) => records.length), [30, 80, 60, 150, 15]);
  assert.equal(new Set(data.deals.map((deal) => deal.stage)).size, 6);
  assert.equal(new Set(data.deals.map((deal) => deal.risk)).size, 3);
  assert.equal(new Set(data.activities.map((activity) => activity.type)).size, 4);
  const fields = new Set(data.proposals.flatMap((proposal) => proposal.changes.map((change) => change.field)));
  for (const field of ["stage", "expectedCloseDate", "nextStep", "probability", "role", "email"] as const) assert.ok(fields.has(field));
  assert.ok(data.accounts.every((account) => new URL(account.website!).hostname.endsWith(".example")));
});

test("invalid imported field values and immutable fields are rejected", () => {
  const change = seed.proposals[0].changes[0];
  for (const invalid of [
    { ...change, field: "value", before: 100, after: "200" },
    { ...change, field: "probability", before: 20, after: 101 },
    { ...change, field: "expectedCloseDate", before: null, after: "2026-02-30" },
    { ...change, field: "id", after: "another-id" },
    { ...change, field: "toString", after: "inherited" },
    { ...change, field: "__proto__", after: "inherited" },
    { ...change, field: "constructor", after: "inherited" },
    { ...change, field: "stage", after: null },
  ]) assert.equal(proposalChangeSchema.safeParse(invalid).success, false);
  assert.ok(proposalChangeSchema.safeParse({ ...change, field: "nextStep", before: null, after: "Arrange technical review." }).success);
});

test("account website import accepts HTTP(S) only", () => {
  for (const website of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "file:///etc/passwd", "//attacker.example"]) {
    const copy = structuredClone(seed);
    copy.accounts[0].website = website;
    assert.equal(seedDataSchema.safeParse(copy).success, false);
  }
});

test("duplicate IDs, broken relationships, stale snapshots and fabricated evidence are rejected", () => {
  const mutations: ((data: typeof seed) => void)[] = [
    (data) => { data.accounts[1].id = data.accounts[0].id; },
    (data) => { data.contacts[0].accountId = "missing"; },
    (data) => { data.activities[0].dealId = data.deals[2].id; },
    (data) => { data.activities[0].participants = [data.contacts.at(-1)!.id]; },
    (data) => { data.proposals[0].changes[0].before = "ClosedLost"; },
    (data) => { data.proposals[0].evidence[0].text = "Unsupported claim."; },
    (data) => { data.proposals[0].createdAt = "2026-01-01T00:00:00.000Z"; },
  ];
  for (const mutate of mutations) {
    const copy = structuredClone(seed);
    mutate(copy);
    assert.equal(seedDataSchema.safeParse(copy).success, false);
  }
});


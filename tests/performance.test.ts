import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { QueryObserver, type QueryKey } from "@tanstack/react-query";
import { loadSeedData } from "../lib/db/seed";
import { generateStressWorkspace, stressSizes } from "../lib/simulation/generate-stress-workspace";
import { seedDataSchema } from "../data/seed/validate";
import { buildContactRows, involvesContact } from "../features/contacts/contacts-model";
import { buildActivityRows, filterActivityRows } from "../features/activity/activity-model";
import { buildSearchIndex, searchIndex } from "../features/search/search-index";
import { createQueryClient } from "../lib/query/client";
import { queryKeys } from "../lib/query/keys";
import { DealPatchDatabase } from "../lib/db/database";
import { createReviewRepository } from "../lib/repositories/reviews";
import { approvalMutationOptions } from "../features/reviews/approval-mutations";
import { reviewActionMutationOptions } from "../features/reviews/review-action-mutations";

const seed = loadSeedData();

test("stress generator is deterministic, validated, related and leaves normal seed unchanged", () => {
  const before = structuredClone(seed);
  const generated = generateStressWorkspace(seed);
  assert.deepEqual(Object.fromEntries(Object.entries(generated).map(([name, records]) => [name, records.length])), stressSizes);
  assert.deepEqual(generateStressWorkspace(seed), generated);
  assert.deepEqual(seed, before);
  assert.equal(seedDataSchema.parse(generated).activities.length, 25_000);
  assert.throws(() => generateStressWorkspace(seed, { ...stressSizes, deals: -1 }), RangeError);
  assert.throws(() => generateStressWorkspace(seed, { ...stressSizes, contacts: 2 }), RangeError);
});

test("large search/filter results retain grouping, partial matching, full totals and bounded visible results", () => {
  const data = generateStressWorkspace(seed);
  const index = buildSearchIndex(data);
  assert.equal(index.length, 41_500);
  const all = searchIndex(index, "");
  assert.equal(all.total, index.length);
  assert.equal(all.groups.length, 5);
  assert.equal(all.entries.length, 30);
  const contact = searchIndex(index, "CONTACT10000@");
  assert.equal(contact.total, 1);
  assert.equal(contact.entries[0].href, "/workspace/contacts/stress-contact-10000");
  const rows = buildActivityRows(data.activities, data.accounts, data.deals);
  const matching = filterActivityRows(rows, { type: "Email", accountId: "stress-account-2", search: "ROLLOUT" });
  assert.equal(matching.length, 50);
  assert.ok(matching.every(row => row.activity.type === "Email" && row.activity.accountId === "stress-account-2"));
  const contacts = buildContactRows(data.contacts, data.accounts, data.deals, data.activities, data.proposals);
  for (const row of [contacts[0], contacts[499], contacts[9999]]) {
    const history = data.activities.filter(activity => activity.accountId === row.accountId && activity.participants?.includes(row.id));
    assert.equal(row.lastActivityAt, history.map(activity => activity.occurredAt).sort().at(-1));
    assert.equal(row.pendingReviews, data.proposals.filter(proposal => involvesContact(proposal, row, true)).length);
  }
});

test("contact relationship index counts a proposal once and excludes foreign participation", () => {
  const contact = seed.contacts[0];
  const activity = { ...seed.activities[0], accountId: contact.accountId, participants: [contact.id] };
  const proposal = { ...seed.proposals[0], accountId: contact.accountId, changes: [
    { id: "role", entityType: "Contact" as const, entityId: contact.id, field: "role" as const, before: contact.role ?? null, after: "Revenue Manager", selected: true, status: "Pending" as const },
    { id: "email", entityType: "Contact" as const, entityId: contact.id, field: "email" as const, before: contact.email ?? null, after: "revenue@example.test", selected: true, status: "Pending" as const },
  ] };
  const row = buildContactRows([contact], seed.accounts, seed.deals, [activity, { ...activity, accountId: "foreign", occurredAt: "2027-01-01T00:00:00Z" }], [proposal])[0];
  assert.equal(row.pendingReviews, 1);
  assert.equal(row.lastActivityAt, activity.occurredAt);
});

test("review approval and suggestion edits do not refetch unrelated entity or account caches", async () => {
  const db = new DealPatchDatabase(`performance-${randomUUID()}`);
  const client = createQueryClient();
  const unsubscribe: (() => void)[] = [];
  try {
    const repo = createReviewRepository(db);
    const queue = await repo.getQueue();
    const item = queue[0];
    client.setQueryData(queryKeys.proposals.queue, queue);
    client.setQueryData(queryKeys.proposals.reviewItems, queue);
    const reads = new Map<string, number>();
    async function observe(key: QueryKey, read: () => Promise<unknown>) {
      const name = JSON.stringify(key);
      const options = { queryKey: key, staleTime: Infinity, queryFn: async () => { reads.set(name, (reads.get(name) ?? 0) + 1); return read(); } };
      await client.fetchQuery(options);
      unsubscribe.push(new QueryObserver(client, options).subscribe(() => {}));
      return name;
    }
    const dealRead = await observe(queryKeys.deals.list, () => db.deals.toArray());
    const unrelated = await Promise.all([
      observe(queryKeys.contacts.list, () => db.contacts.toArray()),
      observe(queryKeys.activities.list, () => db.activities.toArray()),
      observe(queryKeys.accounts.list, () => db.accounts.toArray()),
      observe(queryKeys.audit.forAccount("account_002"), () => db.auditEvents.toArray()),
      observe(queryKeys.proposals.forAccount("account_002"), () => db.proposals.where("accountId").equals("account_002").toArray()),
    ]);
    const auditRead = await observe(queryKeys.audit.forAccount(item.proposal.accountId), () => db.auditEvents.toArray());
    const activitySnapshot = client.getQueryData(queryKeys.activities.list);
    await client.getMutationCache().build(client, approvalMutationOptions(client, repo)).execute({ id: item.proposal.id, expectedProposal: item.proposal, changeIds: [item.proposal.changes[0].id] });
    assert.equal(reads.get(dealRead), 2);
    assert.equal(reads.get(auditRead), 2);
    for (const key of unrelated) assert.equal(reads.get(key), 1, key);
    assert.equal(client.getQueryData(queryKeys.activities.list), activitySnapshot);
    const partial = client.getQueryData<typeof queue>(queryKeys.proposals.queue)!.find(row => row.proposal.id === item.proposal.id)!;
    await client.getMutationCache().build(client, reviewActionMutationOptions(client, repo)).execute({ id: item.proposal.id, expectedProposal: partial.proposal, action: { type: "edit", changeId: item.proposal.changes[1].id, value: 55 } });
    assert.equal(reads.get(dealRead), 2, "Editing a suggestion never refetches the deal");
    for (const key of unrelated) assert.equal(reads.get(key), 1, key);
    assert.equal(reads.get(auditRead), 3);
  } finally { unsubscribe.forEach(stop => stop()); client.clear(); await db.delete(); }
});

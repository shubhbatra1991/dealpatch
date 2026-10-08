import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MutationObserver, onlineManager } from "@tanstack/react-query";
import { createQueryClient } from "../lib/query/client";
import { QueryProvider } from "../lib/query/provider";
import { queryKeys } from "../lib/query/keys";
import { dealsQueryOptions, useDeals } from "../features/pipeline/use-deals";
import { accountsQueryOptions, useAccounts } from "../features/accounts/use-accounts";
import { pendingProposalsQueryOptions, usePendingProposals } from "../features/reviews/use-pending-proposals";
import { dealRepository } from "../lib/repositories/deals";
import { accountRepository } from "../lib/repositories/accounts";
import { proposalRepository } from "../lib/repositories/proposals";
import accounts from "../data/seed/accounts.json";
import deals from "../data/seed/deals.json";
import proposals from "../data/seed/proposals.json";
import { accountSchema } from "../domain/accounts/schema";
import { dealSchema } from "../domain/deals/schema";
import { proposalSchema } from "../domain/proposals/schema";

const account = accountSchema.parse(accounts[0]);
const deal = dealSchema.parse(deals[0]);
const proposal = proposalSchema.parse(proposals[0]);

test("query options delegate to repositories and infer the matching data shape", async (t) => {
  const dealRead = t.mock.method(dealRepository, "getAll", async () => [deal]);
  const accountRead = t.mock.method(accountRepository, "getAll", async () => [account]);
  const proposalRead = t.mock.method(proposalRepository, "getPending", async () => [proposal]);
  const client = createQueryClient();
  try {
    assert.deepEqual(await client.fetchQuery(dealsQueryOptions), [deal]);
    assert.deepEqual(await client.fetchQuery(accountsQueryOptions), [account]);
    assert.deepEqual(await client.fetchQuery(pendingProposalsQueryOptions), [proposal]);
    assert.equal(dealRead.mock.callCount(), 1);
    assert.equal(accountRead.mock.callCount(), 1);
    assert.equal(proposalRead.mock.callCount(), 1);
  } finally { client.clear(); }
});

test("fresh reads are cached, entity invalidation refetches, and clients are isolated", async (t) => {
  const read = t.mock.method(dealRepository, "getAll", async () => [deal]);
  const client = createQueryClient();
  const other = createQueryClient();
  try {
    await client.fetchQuery(dealsQueryOptions);
    await client.fetchQuery(dealsQueryOptions);
    assert.equal(read.mock.callCount(), 1);
    assert.equal(other.getQueryData(queryKeys.deals.list), undefined);
    client.setQueryData(queryKeys.accounts.list, [account]);
    await client.invalidateQueries({ queryKey: queryKeys.deals.all, refetchType: "none" });
    assert.equal(client.getQueryState(queryKeys.deals.list)?.isInvalidated, true);
    assert.equal(client.getQueryState(queryKeys.accounts.list)?.isInvalidated, false);
    await client.fetchQuery(dealsQueryOptions);
    assert.equal(read.mock.callCount(), 2);
  } finally { client.clear(); other.clear(); }
});

test("local reads and mutations proceed while offline", async (t) => {
  const wasOnline = onlineManager.isOnline();
  const client = createQueryClient();
  t.mock.method(dealRepository, "getAll", async () => [deal]);
  onlineManager.setOnline(false);
  try {
    assert.deepEqual(await client.fetchQuery(dealsQueryOptions), [deal]);
    const mutation = new MutationObserver(client, { mutationFn: async (value: number) => value + 1 });
    assert.equal(await mutation.mutate(10), 11);
  } finally { onlineManager.setOnline(wasOnline); client.clear(); }
});

test("local storage errors are exposed without automatic retries", async (t) => {
  const read = t.mock.method(dealRepository, "getAll", async () => { throw new Error("Storage unavailable"); });
  const client = createQueryClient();
  try {
    await assert.rejects(client.fetchQuery(dealsQueryOptions), /Storage unavailable/);
    assert.equal(read.mock.callCount(), 1);
    assert.equal(client.getQueryState(queryKeys.deals.list)?.status, "error");
  } finally { client.clear(); }
});

test("the provider renders all hooks during SSR without repository reads", (t) => {
  const dealRead = t.mock.method(dealRepository, "getAll");
  const accountRead = t.mock.method(accountRepository, "getAll");
  const proposalRead = t.mock.method(proposalRepository, "getPending");
  function Probe() {
    const deals = useDeals();
    const accounts = useAccounts();
    const proposals = usePendingProposals();
    return createElement("p", null, `${deals.fetchStatus}/${accounts.fetchStatus}/${proposals.fetchStatus}`);
  }
  const html = renderToString(createElement(QueryProvider, null, createElement(Probe)));
  assert.ok(html.includes("idle/idle/idle"));
  assert.equal(dealRead.mock.callCount(), 0);
  assert.equal(accountRead.mock.callCount(), 0);
  assert.equal(proposalRead.mock.callCount(), 0);
});


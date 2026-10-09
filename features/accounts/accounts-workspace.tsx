"use client";

import { useMemo } from "react";
import { usePendingProposals } from "../reviews/use-pending-proposals";
import { useAccountCore } from "./use-account-data";
import { buildAccountRows } from "./accounts-model";
import { AccountsTable } from "./accounts-table";
import { AccountQueryState } from "./account-query-state";

export function AccountsWorkspace() {
  const { accounts, deals, activities } = useAccountCore();
  const proposals = usePendingProposals();
  const data = useMemo(() => accounts.data && deals.data && activities.data && proposals.data ? buildAccountRows(accounts.data, deals.data, activities.data, proposals.data) : null, [accounts.data, deals.data, activities.data, proposals.data]);
  const queries = [accounts, deals, activities, proposals];
  const fetching = queries.some(query => query.isFetching);
  return <section aria-labelledby="accounts-title" className="flex h-full min-h-0 flex-col gap-3">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3"><div><h1 id="accounts-title" className="text-lg font-semibold tracking-tight">Accounts</h1><p className="mt-1 text-xs text-text-muted">Company relationships, open pipeline and review priorities.</p></div><span role="status" className="text-[11px] text-text-muted">{data && fetching ? "Updating…" : "Local workspace"}</span></header>
    <AccountQueryState failed={queries.some(query => query.isError)} ready={Boolean(data)} fetching={fetching} retry={() => { for (const query of queries) void query.refetch(); }} />
    {data && <AccountsTable data={data} />}
  </section>;
}

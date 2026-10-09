"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccounts } from "../accounts/use-accounts";
import { useActivities } from "../activity/use-activities";
import { useDeals } from "../pipeline/use-deals";
import { usePendingProposals } from "../reviews/use-pending-proposals";
import { PipelineStageSummary, ReviewQueueSummary, WorkspaceHealth, WorkspaceSummary } from "./dashboard-summary";
import { NeedsAttention, RecentActivity, SuggestedActions } from "./dashboard-worklists";
import { buildOverview } from "./overview-model";

export function OverviewWorkspace() {
  const deals = useDeals();
  const accounts = useAccounts();
  const activities = useActivities();
  const proposals = usePendingProposals();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  const data = useMemo(() => deals.data && accounts.data && activities.data && proposals.data
    ? buildOverview(deals.data, accounts.data, activities.data, proposals.data, now) : null,
  [deals.data, accounts.data, activities.data, proposals.data, now]);
  const queries = [deals, accounts, activities, proposals];
  const failed = queries.some(query => query.isError);
  const refreshing = queries.some(query => query.isFetching);
  const refresh = () => { setNow(new Date()); void Promise.all(queries.map(query => query.refetch())); };

  return <section aria-labelledby="overview-title" className="mx-auto max-w-[1440px] space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-3 pb-1">
      <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">Sales workspace</p><h1 id="overview-title" className="text-xl font-semibold tracking-tight text-text">Overview</h1><p className="mt-1 text-xs text-text-muted">Pipeline signals, review decisions, and the work to move forward.</p></div>
      <div className="flex items-center gap-3"><p className="text-right text-[10px] leading-4 text-text-muted">Fictional local workspace{data && <><br /><time dateTime={data.today}>{data.today}</time> · UTC</>}</p><button type="button" onClick={refresh} disabled={refreshing} className="rounded-sm border border-border-strong bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-bg-subtle disabled:border-dashed">{refreshing ? "Refreshing…" : "Refresh"}</button></div>
    </header>
    {failed && <div role="alert" className="workspace-state flex flex-wrap items-center justify-between gap-2 rounded-sm border border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning"><p>{data ? "Some local data could not refresh. Showing the last available values." : "Unable to load the dashboard. Check that browser storage is available."}</p><button type="button" onClick={refresh} disabled={refreshing} className="rounded-sm font-semibold underline underline-offset-4 disabled:border-dashed">Retry loading dashboard</button></div>}
    {!data && !failed && <p role="status" className="workspace-state rounded-sm border border-border bg-bg-subtle px-3 py-6 text-xs text-text-muted">Loading local workspace signals…</p>}
    {data && <>
      <WorkspaceSummary data={data} />
      <div className="grid items-start gap-3 lg:grid-cols-3"><WorkspaceHealth data={data} /><PipelineStageSummary data={data} /><ReviewQueueSummary data={data} /></div>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><NeedsAttention data={data} /><SuggestedActions data={data} /></div>
      <RecentActivity data={data} />
      <p className="text-[10px] leading-4 text-text-muted">Derived from your local workspace. Attention checks cover open deals only; activity is stale after 14 days. Suggested actions require human judgment.</p>
    </>}
  </section>;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useAccounts } from "../accounts/use-accounts";
import { useContacts } from "../contacts/use-contacts";
import { useDeals } from "../pipeline/use-deals";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { useActivities } from "./use-activities";
import { useDemoAnalysis } from "./use-demo-analysis";
import { ActivityFeed } from "./activity-feed";
import { ActivityDetail } from "./activity-detail";
import { activityTypes, adjacentActivityId, buildActivityRows, filterActivityRows, type ActivityFilters } from "./activity-model";

const control = "h-8 min-w-0 rounded-sm border border-border-strong bg-surface px-2 text-xs text-text";

export function ActivityWorkspace({ targetActivityId }: { targetActivityId?: string }) {
  const activities = useActivities();
  const accounts = useAccounts();
  const contacts = useContacts();
  const deals = useDeals();
  const [selection, setSelectedId] = useState<string | undefined>(targetActivityId);
  const [filters, setFilters] = useState<ActivityFilters>({ search: "", type: "", accountId: "" });
  const detail = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const focusedTarget = useRef(false);
  const rows = useMemo(() => buildActivityRows(activities.data ?? [], accounts.data ?? [], deals.data ?? []), [activities.data, accounts.data, deals.data]);
  const matching = useMemo(() => filterActivityRows(rows, filters), [rows, filters]);
  const selectedId = selection ?? rows[0]?.activity.id ?? "";
  const selected = rows.find(row => row.activity.id === selectedId);
  const analysis = useDemoAnalysis(undefined, selected?.activity.id);
  const ready = activities.data !== undefined && accounts.data !== undefined && deals.data !== undefined && contacts.data !== undefined;
  const failed = activities.isError || accounts.isError || deals.isError || contacts.isError;
  const queueing = analysis.queue.isPending;
  const selectedRef = useRef(selectedId);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  const resetAnalysis = analysis.reset;
  const sortedAccounts = useMemo(() => [...(accounts.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [accounts.data]);

  useEffect(() => {
    if (ready && targetActivityId && selected && !focusedTarget.current) {
      focusedTarget.current = true;
      detail.current?.focus();
    }
  }, [ready, targetActivityId, selected]);

  const select = useCallback((id: string) => {
    if (queueing || id === selectedRef.current) return;
    selectedRef.current = id;
    resetAnalysis();
    setSelectedId(id);
  }, [queueing, resetAnalysis]);
  function move(direction: number) {
    if (queueing) return;
    const id = adjacentActivityId(matching, selectedId, direction);
    if (!id) return;
    flushSync(() => select(id));
    Array.from(feed.current?.querySelectorAll<HTMLButtonElement>("button[data-activity-id]") ?? []).find(button => button.dataset.activityId === id)?.focus();
  }
  function openDetail() { requestAnimationFrame(() => detail.current?.focus()); }
  useWorkspaceShortcuts({ next: () => move(1), previous: () => move(-1), open: openDetail });
  function retry() { void activities.refetch(); void accounts.refetch(); void deals.refetch(); void contacts.refetch(); }
  const hasFilters = Boolean(filters.search || filters.type || filters.accountId);

  return <section aria-labelledby="activity-title" className="space-y-3">
    <header className="border-b border-border pb-3"><h1 id="activity-title" className="text-lg font-semibold tracking-tight">Activity</h1><p className="mt-1 text-sm text-text-muted">Browse source activity and build transparent, human-reviewed suggestions.</p></header>
    {failed && <div role="alert" className="flex flex-wrap items-center gap-3 border border-danger-border bg-danger-soft p-3 text-xs text-danger"><p>Unable to {ready ? "refresh" : "load"} local activity data.{ready ? " Showing the last loaded records." : ""}</p><button type="button" onClick={retry} className="rounded-sm underline">Retry</button></div>}
    {!ready && !failed && <p role="status" aria-busy="true" className="p-3 text-sm text-text-muted">Loading local activities…</p>}
    {ready && selectedId && !selected && <p role="status" className="text-xs text-warning">The selected activity is no longer in this workspace. Choose another source.</p>}
    {ready && <div className="grid items-start gap-3 lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]">
      <section aria-labelledby="feed-title" className="workspace-panel min-w-0 rounded-sm border border-border bg-surface">
        <header className="space-y-2 border-b border-border bg-bg-subtle/70 p-3"><div className="flex items-center justify-between gap-2"><h2 id="feed-title" className="text-sm font-semibold">Activity feed</h2><span className="text-[10px] text-text-muted">Newest first</span></div>
          <label className="flex flex-col gap-1 text-xs text-text-muted">Search activities<input type="search" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Title, account, deal or source text…" className={control} /></label>
          <div className="grid grid-cols-2 gap-2"><label className="flex min-w-0 flex-col gap-1 text-xs text-text-muted">Activity type<select value={filters.type} onChange={event => setFilters({ ...filters, type: activityTypes.find(type => type === event.target.value) ?? "" })} className={control}><option value="">All types</option>{activityTypes.map(type => <option key={type}>{type}</option>)}</select></label>
            <label className="flex min-w-0 flex-col gap-1 text-xs text-text-muted">Account<select value={filters.accountId} onChange={event => setFilters({ ...filters, accountId: event.target.value })} className={control}><option value="">All accounts</option>{sortedAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted"><p role="status">{matching.length} of {rows.length} activities</p>{hasFilters && <button type="button" onClick={() => setFilters({ search: "", type: "", accountId: "" })} className="rounded-sm underline">Clear filters</button>}</div>
        </header>
        <div ref={feed} role="region" aria-label="Activity feed, scroll for more records" tabIndex={0} className="max-h-[26rem] overflow-y-auto lg:max-h-[calc(100dvh-19rem)] lg:min-h-48">
          {matching.length ? <ActivityFeed rows={matching} selectedId={selectedId} onSelect={select} onOpen={openDetail} disabled={queueing} scrollRef={feed} /> : <div className="space-y-1 p-4 text-xs text-text-muted"><p className="font-medium text-text">{rows.length ? "No matching activities" : "No activities yet"}</p><p>{rows.length ? "Try a different search, activity type or account." : "Activities will appear here when available in the local workspace."}</p></div>}
        </div>
        <p className="border-t border-border px-3 py-2 text-[10px] leading-5 text-text-muted">J / K or ↑ / ↓ selects · Home / End jumps · Enter focuses details</p>
      </section>
      <div className="min-w-0">{selected ? <>{!matching.some(row => row.activity.id === selectedId) && <p role="status" className="mb-2 text-[11px] text-text-muted">Selected activity is outside the current filters.</p>}{queueing && <p role="status" className="mb-2 text-[11px] text-text-muted">Sending proposal to Review Queue. Activity selection is temporarily paused.</p>}<ActivityDetail row={selected} contacts={contacts.data!} analysis={analysis} detailRef={detail} onRun={() => { setSelectedId(selectedId); void analysis.start({ activity: selected.activity, accounts: accounts.data!, deals: deals.data! }); }} /></> : <section aria-label="Selected activity" className="rounded-sm border border-border p-5"><h2 className="text-sm font-semibold">Select an activity</h2><p className="mt-2 text-xs leading-5 text-text-muted">Choose a record from the feed to inspect its full source text, participants and related opportunity. Run simulated analysis when you are ready; nothing is applied automatically.</p></section>}</div>
    </div>}
  </section>;
}

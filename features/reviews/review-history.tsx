"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useReviewItems } from "./use-review-queue";
import { useReviewHistoryAudit } from "./use-review-history";
import { buildReviewHistory, filterReviewHistory, historyFilters, type HistoryFilter } from "./review-history-model";
import { ReviewHistoryItem } from "./review-history-item";

export function ReviewHistory({ targetProposalId }: { targetProposalId?: string }) {
  const reviews = useReviewItems();
  const audit = useReviewHistoryAudit();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<HistoryFilter>("All");
  const [accountId, setAccountId] = useState("");
  const [oldest, setOldest] = useState(false);
  const [limit, setLimit] = useState(50);
  const entries = useMemo(() => buildReviewHistory(reviews.data ?? [], audit.data ?? []), [reviews.data, audit.data]);
  const filtered = useMemo(() => filterReviewHistory(entries, { search, status, accountId, oldest }), [entries, search, status, accountId, oldest]);
  const accounts = [...new Map(entries.map(entry => [entry.item.proposal.accountId, entry.item.account])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const target = targetProposalId ? filtered.find(entry => entry.item.proposal.id === targetProposalId) : undefined;
  const shown = filtered.slice(0, limit);
  if (target && !shown.includes(target)) shown.unshift(target);
  const loading = reviews.isPending || audit.isPending;
  const error = reviews.isError || audit.isError;
  return <section aria-labelledby="review-history-title" className="space-y-3">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3"><div><h1 id="review-history-title" className="text-lg font-semibold tracking-tight">Review History</h1><p className="mt-1 text-sm text-text-muted">Inspect preserved decisions, field outcomes and approval reversals.</p></div><Link href="/workspace/reviews" className="rounded-sm text-xs text-accent underline">Open Review Queue</Link></header>
    <p className="text-xs text-text-muted">Partial reviews can still have actionable fields in the queue. History never applies changes.</p>
    <div className="flex flex-wrap gap-3 text-xs">
      <label className="flex flex-col gap-1">Search review history<input type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(50); }} className="h-8 rounded-sm border border-border-strong bg-surface px-2" /></label>
      <label className="flex flex-col gap-1">History status<select value={status} onChange={event => { setStatus(historyFilters.find(value => value === event.target.value) ?? "All"); setLimit(50); }} className="h-8 rounded-sm border border-border-strong bg-surface px-2">{historyFilters.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="flex flex-col gap-1">History account<select value={accountId} onChange={event => { setAccountId(event.target.value); setLimit(50); }} className="h-8 max-w-full rounded-sm border border-border-strong bg-surface px-2"><option value="">All accounts</option>{accounts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="flex flex-col gap-1">History order<select value={oldest ? "oldest" : "newest"} onChange={event => setOldest(event.target.value === "oldest")} className="h-8 rounded-sm border border-border-strong bg-surface px-2"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
    </div>
    {loading && <p role="status" className="text-xs text-text-muted">Loading review history…</p>}
    {error && <p role="alert" className="text-xs text-danger">Unable to load complete review history. <button type="button" className="rounded-sm underline" onClick={() => { void reviews.refetch(); void audit.refetch(); }}>Retry</button></p>}
    {!loading && !error && <>
      <p role="status" className="text-xs text-text-muted">Reviewed proposals · {filtered.length}</p>
      {targetProposalId && !entries.some(entry => entry.item.proposal.id === targetProposalId) && <p className="text-xs text-text-muted">This proposal has no recorded decision or is no longer available. Pending suggestions remain in Review Queue.</p>}
      {!filtered.length && <p className="border border-border p-4 text-xs text-text-muted">{entries.length ? "No matching review history. Try another search or filter." : "No completed review decisions yet."}</p>}
      <ul aria-label="Review history" className="workspace-panel rounded-sm border border-border bg-surface">{shown.map(entry => <ReviewHistoryItem key={entry.item.proposal.id} entry={entry} expanded={entry.item.proposal.id === targetProposalId} />)}</ul>
      {filtered.length > limit && <button type="button" onClick={() => setLimit(value => value + 50)} className="rounded-sm border border-border-strong px-3 py-2 text-xs">Show more reviews</button>}
    </>}
  </section>;
}

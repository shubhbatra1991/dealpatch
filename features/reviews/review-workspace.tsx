"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { ReviewCard } from "./review-card";
import { ReviewList } from "./review-list";
import { useReviewItems, useReviewQueue } from "./use-review-queue";
import { filterReviewItems, reviewFilters, selectedReview, type ReviewFilter } from "./review-model";

export function ReviewWorkspace({ targetProposalId }: { targetProposalId?: string }) {
  const reviews = useReviewItems();
  const queue = useReviewQueue();
  const [filter, setFilter] = useState<ReviewFilter>(targetProposalId ? "All" : "Pending work");
  const [selectedId, setSelectedId] = useState<string | undefined>(targetProposalId);
  const [dialogOpen, setDialogOpen] = useState(Boolean(targetProposalId));
  const [message, setMessage] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const focusedTarget = useRef(false);
  const items = reviews.data ?? [];
  const visible = filterReviewItems(items, filter);
  const selected = selectedReview(items, visible, selectedId);
  const activeId = selected?.proposal.id;
  const index = visible.findIndex(item => item.proposal.id === activeId);
  useEffect(() => {
    if (targetProposalId && selected && !focusedTarget.current) {
      focusedTarget.current = true;
      document.getElementById(`${targetProposalId}-review`)?.focus();
    }
  }, [targetProposalId, selected]);
  function focusItem(next: number) {
    const item = visible[next];
    if (!item) return;
    flushSync(() => setSelectedId(item.proposal.id));
    document.getElementById(`${item.proposal.id}-summary`)?.focus();
  }
  useWorkspaceShortcuts({ next: () => focusItem(Math.min(visible.length - 1, index + 1)), previous: () => focusItem(Math.max(0, index - 1)) });
  function restoreFocus() { (document.getElementById(`${activeId}-summary`) ?? heading.current)?.focus(); }
  function refresh() { void reviews.refetch(); void queue.refetch(); }
  return <section aria-labelledby="reviews-title" className="space-y-3">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
      <div><h1 ref={heading} tabIndex={-1} id="reviews-title" className="text-lg font-semibold tracking-tight">Review Queue</h1><p className="mt-1 text-sm text-text-muted">Inspect the source, compare field changes, then decide what to apply.</p></div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted"><p>{queue.data ? `${queue.data.length} pending proposals - Oldest first` : "Local workspace"}</p><button type="button" disabled={reviews.isFetching || queue.isFetching} onClick={refresh} className="rounded-sm border border-border-strong px-2 py-1 disabled:border-dashed">Refresh current values</button></div>
    </header>
    <p className="text-xs text-text-muted">Simulated suggestions - Nothing is applied without human approval. Stale fields stay blocked.</p>
    <p role="status" aria-live="polite" className={message ? "border-l-2 border-accent bg-accent-soft/50 px-3 py-2 text-xs text-text" : "sr-only"}>{message}</p>
    {(reviews.isError || queue.isError) && <div role="alert" className="border border-danger-border bg-danger-soft p-3 text-xs text-danger">Unable to {reviews.data ? "refresh" : "load"} review data. {reviews.data ? "Showing the last loaded proposals." : "Check local storage and retry."} <button type="button" onClick={refresh} className="rounded-sm underline">Retry</button></div>}
    {reviews.isPending && <p role="status" aria-busy="true" className="p-3 text-xs text-text-muted">Loading proposals from your workspace...</p>}
    {reviews.data && targetProposalId && !items.some(item => item.proposal.id === targetProposalId) && <p role="status" className="border border-border p-3 text-xs">The selected proposal is no longer in this workspace. Choose another review.</p>}
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
      <section aria-labelledby="review-list-title" className="workspace-panel min-w-0 rounded-sm border border-border bg-surface">
        <header className="space-y-2 border-b border-border bg-bg-subtle/70 p-3"><h2 id="review-list-title" className="text-sm font-semibold">Proposals - {visible.length}</h2><label className="flex items-center justify-between gap-3 text-xs text-text-muted">Proposal status<select value={filter} onChange={event => { setFilter(reviewFilters.find(filter => filter === event.target.value) ?? "Pending work"); setSelectedId(undefined); setDialogOpen(false); }} className="h-8 rounded-sm border border-border-strong bg-surface px-2">{reviewFilters.map(filter => <option key={filter}>{filter}</option>)}</select></label></header>
        <div className="max-h-[28rem] overflow-y-auto xl:max-h-[calc(100dvh-18rem)]">
          <ReviewList items={visible} selectedId={activeId} onSelect={setSelectedId} onOpen={id => { setSelectedId(id); setDialogOpen(true); }} />
          {reviews.data && !visible.length && <div className="space-y-1 p-4 text-xs text-text-muted"><h3 className="font-semibold text-text">{filter === "Pending work" ? "Queue cleared" : "No matching proposals"}</h3><p>{filter === "Pending work" ? "There are no proposals awaiting review. Choose All to inspect past decisions." : "Choose another status to inspect this workspace's review history."}</p></div>}
        </div>
        <p className="border-t border-border px-3 py-2 text-[10px] text-text-muted">Up / Down or J / K to navigate - Enter opens review</p>
      </section>
      <div className="min-w-0 space-y-2">
        {selected && !visible.some(item => item.proposal.id === activeId) && <p role="status" className="text-xs text-text-muted">Selected review is outside the current filter. Its outcome remains available below.</p>}
        {selected ? <ReviewCard key={activeId} item={selected} active onActivate={() => setSelectedId(activeId)} dialogOpen={dialogOpen} onOpenChange={setDialogOpen} restoreFocus={restoreFocus} onReviewed={message => { setSelectedId(current => current ?? activeId); setMessage(message); if (!message.startsWith("Applying")) requestAnimationFrame(() => document.getElementById(`${activeId}-review`)?.focus()); }} /> : reviews.data && <p className="rounded-sm border border-border p-4 text-xs text-text-muted">Select a proposal to inspect its source, evidence and field-level changes.</p>}
      </div>
    </div>
  </section>;
}

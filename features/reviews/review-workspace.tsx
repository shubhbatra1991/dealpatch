"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { ReviewCard } from "./review-card";
import { useReviewQueue } from "./use-review-queue";
import { useAllProposals } from "./use-proposals";
import { accountHref } from "../accounts/accounts-model";
import { ReviewHistory } from "./review-history";

export function ReviewWorkspace({ targetProposalId }: { targetProposalId?: string }) {
  const queue = useReviewQueue();
  const heading = useRef<HTMLHeadingElement>(null);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(targetProposalId);
  const focusedTarget = useRef(false);
  const items = queue.data ?? [];
  const selectedIndex = Math.max(0, items.findIndex(item => item.proposal.id === selectedId));
  const activeId = items[selectedIndex]?.proposal.id;
  const hasTarget = items.some(item => item.proposal.id === targetProposalId);
  useEffect(() => {
    if (targetProposalId && hasTarget && !focusedTarget.current) {
      focusedTarget.current = true;
      const target = document.getElementById(`${targetProposalId}-review`);
      target?.focus(); target?.scrollIntoView({ block: "nearest" });
    }
  }, [targetProposalId, hasTarget]);
  function focusItem(index: number) {
    const item = items[index];
    if (!item) return;
    flushSync(() => setSelectedId(item.proposal.id));
    document.getElementById(`${item.proposal.id}-review`)?.focus();
  }
  useWorkspaceShortcuts({ next: () => focusItem(Math.min(items.length - 1, selectedIndex + 1)), previous: () => focusItem(Math.max(0, selectedIndex - 1)) });
  return <section aria-labelledby="reviews-title" className="mx-auto max-w-6xl space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3">
      <div><h1 ref={heading} tabIndex={-1} id="reviews-title" className="text-lg font-semibold tracking-tight">Review Queue</h1><p className="mt-1 text-sm text-zinc-600">Review the source, compare changes, then decide what to apply.</p></div>
      <p className="pt-1 text-xs text-zinc-500">{queue.data ? `${queue.data.length} pending proposals · Oldest first` : "Local workspace"}</p>
      <button type="button" disabled={queue.isFetching} onClick={() => void queue.refetch()} className="rounded-sm border border-zinc-300 px-2 py-1 text-xs disabled:opacity-40">Refresh current values</button>
    </header>
    <p className="text-xs text-zinc-500">Simulated suggestions · No changes are applied automatically. Select individual fields to approve only part of a proposal.</p>
    {queue.data && targetProposalId && !hasTarget && <ReviewTargetStatus id={targetProposalId} />}
    <p role="status" aria-live="polite" className={message ? "border-l-2 border-indigo-500 bg-indigo-50/50 px-3 py-2 text-xs text-zinc-800" : "sr-only"}>{message}</p>
    {queue.isError && <div role="alert" className="flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p>Unable to {queue.data ? "refresh" : "load"} the review queue. {queue.data ? "Showing the last loaded proposals." : "Check local storage and retry."}</p><button type="button" disabled={queue.isFetching} onClick={() => void queue.refetch()} className="underline underline-offset-4">Retry</button></div>}
    {queue.isPending && <p role="status" aria-busy="true" className="border border-zinc-200 p-4 text-sm text-zinc-500">Loading proposals from your workspace…</p>}
    {queue.data?.length === 0 && <div className="border border-zinc-200 p-5"><h2 className="text-sm font-semibold">Queue cleared</h2><p className="mt-1 text-sm text-zinc-500">There are no proposals awaiting review. Your decisions are saved in this local workspace.</p></div>}
    <p className="text-xs text-zinc-500">J / K to navigate · Enter opens review · A approves selected fields · R rejects the highlighted proposal.</p>
    {queue.data?.map(item => <ReviewCard key={item.proposal.id} item={item} active={activeId === item.proposal.id} onActivate={() => setSelectedId(item.proposal.id)} onReviewed={message => { setMessage(message); heading.current?.focus(); }} />)}
    <ReviewHistory />
  </section>;
}

function ReviewTargetStatus({ id }: { id: string }) {
  const history = useAllProposals();
  const proposal = history.data?.find(proposal => proposal.id === id);
  return <div role="status" className="border border-zinc-200 p-3 text-xs text-zinc-600">{history.isError ? <><span>Unable to load the selected proposal.</span> <button type="button" onClick={() => void history.refetch()} className="rounded-sm underline">Retry</button></> : !history.data ? "Loading the selected proposal…" : proposal ? <><span>Selected proposal: {proposal.status === "PartiallyApproved" ? "Partially approved" : proposal.status}. It is not in the pending queue.</span> <Link href={accountHref(proposal.accountId)} className="rounded-sm text-indigo-700 underline">View account and change history</Link></> : "The selected proposal is no longer in this workspace."}</div>;
}

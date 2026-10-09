"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import type { ReviewItem } from "../../lib/repositories/reviews";
import { displayTimestamp } from "./review-format";
import { proposalStatusLabel, staleChangeCount } from "./review-model";

export function ReviewList({ items, selectedId, onSelect, onOpen }: { items: ReviewItem[]; selectedId?: string; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  "use no memo";
  const list = useRef<HTMLOListElement>(null);
  const selectedIndex = items.findIndex(item => item.proposal.id === selectedId);
  const virtual = items.length > 200;
  // eslint-disable-next-line react-hooks/incompatible-library -- The virtualizer uses mutable methods; this component opts out of compiler memoization.
  const virtualizer = useVirtualizer({ count: items.length, enabled: virtual, getScrollElement: () => list.current?.parentElement ?? null, estimateSize: () => 168, getItemKey: index => items[index].proposal.id, overscan: 4, initialRect: { width: 0, height: 448 }, rangeExtractor: range => { const visible = defaultRangeExtractor(range); return selectedIndex < 0 || visible.includes(selectedIndex) ? visible : [...visible, selectedIndex].sort((a, b) => a - b); } });
  useEffect(() => { if (virtual && selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: "auto" }); }, [selectedId, selectedIndex, virtual, virtualizer]);
  const rendered = virtual ? virtualizer.getVirtualItems() : items.map((item, index) => ({ key: item.proposal.id, index, start: 0 }));
  function navigate(event: KeyboardEvent<HTMLOListElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-review-id]");
    if (!button) return;
    const index = items.findIndex(item => item.proposal.id === button.dataset.reviewId);
    const next = event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const id = items[next]?.proposal.id;
    if (id) { onSelect(id); requestAnimationFrame(() => document.getElementById(`${id}-summary`)?.focus()); }
  }
  return <ol ref={list} aria-label="Review proposals" onKeyDown={navigate} className="relative divide-y divide-border" style={virtual ? { height: virtualizer.getTotalSize() } : undefined}>
    {rendered.map(virtualItem => {
      const index = virtualItem.index;
      const item = items[index];
      const { proposal } = item;
      const stale = staleChangeCount(item);
      const edited = proposal.changes.some(change => change.edited || change.status === "Edited");
      return <li key={proposal.id} aria-posinset={index + 1} aria-setsize={items.length} style={virtual ? { position: "absolute", top: virtualItem.start, left: 0, width: "100%", height: 168 } : undefined}><button id={`${proposal.id}-summary`} data-review-id={proposal.id} type="button" tabIndex={proposal.id === selectedId || selectedIndex < 0 && index === 0 ? 0 : -1} aria-current={selectedId === proposal.id ? "true" : undefined} aria-label={`${item.account} · ${proposalStatusLabel(proposal.status)} · ${proposal.changes.length} ${proposal.changes.length === 1 ? "change" : "changes"}`} onFocus={() => onSelect(proposal.id)} onClick={() => onSelect(proposal.id)} onKeyDown={event => { if (event.key === "Enter" && !event.repeat) { event.preventDefault(); onOpen(proposal.id); } }} className={`workspace-feed-item block w-full border-l-2 p-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring ${virtual ? "h-[168px] overflow-hidden" : ""} ${selectedId === proposal.id ? "border-accent bg-accent-soft/50" : "border-transparent hover:bg-bg-subtle"}`}>
        <span className="flex flex-wrap justify-between gap-1 text-xs"><strong className="font-semibold">{item.account}</strong><span className="text-text-muted">{proposalStatusLabel(proposal.status)}</span></span>
        <span className="mt-1 block truncate text-xs text-text-muted">{item.deal ?? "Account-level proposal"}</span>
        <span className="mt-1 block truncate text-[11px] text-text-muted">Source: {item.source?.title ?? "Unavailable activity"}</span>
        <span className="mt-1 line-clamp-2 block text-[11px] leading-5 text-text-muted">{proposal.evidence[0]?.text}</span>
        <span className="mt-2 block text-[10px] text-text-muted"><time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time> · {proposal.confidence}% confidence · {proposal.changes.length} {proposal.changes.length === 1 ? "change" : "changes"}{edited ? " · Edited" : ""}</span>
        {stale > 0 && <strong className="mt-1 block text-[11px] text-warning">{stale} stale {stale === 1 ? "change" : "changes"} · review required</strong>}
      </button></li>;
    })}
  </ol>;
}

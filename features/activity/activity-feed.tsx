"use client";

import { memo, useEffect, useRef, type RefObject } from "react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { EntityIcon } from "../../components/shared/entity-icon";
import { displayTimestamp } from "../reviews/review-format";
import { adjacentActivityId, type ActivityRow } from "./activity-model";

const ActivityFeedRow = memo(function ActivityFeedRow({ row: { activity, account, deal }, selected, tabStop, disabled, onSelect, virtual }: { row: ActivityRow; selected: boolean; tabStop: boolean; disabled: boolean; onSelect: (id: string) => void; virtual: boolean }) {
  return <button type="button" data-activity-id={activity.id} tabIndex={tabStop ? 0 : -1} aria-current={selected ? "true" : undefined} disabled={disabled} onClick={() => onSelect(activity.id)} className={`workspace-feed-item block w-full border-l-2 px-3 py-3 text-left focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring disabled:border-dashed ${virtual ? "h-[168px] overflow-hidden" : ""} ${selected ? "border-accent bg-accent-soft/60" : "border-transparent hover:bg-bg-subtle"}`}>
    <span className="flex items-center justify-between gap-1 text-[10px] text-text-muted"><span className="workspace-type-label font-semibold uppercase tracking-wide"><EntityIcon type="activity" className="size-3 shrink-0" />{activity.type}</span><time dateTime={activity.occurredAt}>{displayTimestamp(activity.occurredAt)}</time></span>
    <span className="mt-1 block truncate text-xs font-semibold text-text">{activity.title}</span>
    <span className="mt-1 block truncate text-[11px] text-text-muted">{account?.name ?? "Unavailable account"}</span>
    {activity.dealId && <span className="block truncate text-[11px] text-text-muted">{deal?.title ?? "Unavailable deal"}</span>}
    <span className="mt-1 line-clamp-2 text-xs leading-5 text-text-muted">{activity.summary}</span>
  </button>;
});
ActivityFeedRow.displayName = "ActivityFeedRow";

export function ActivityFeed({ rows, selectedId, onSelect, onOpen, disabled = false, scrollRef }: { rows: ActivityRow[]; selectedId: string; onSelect: (id: string) => void; onOpen: () => void; disabled?: boolean; scrollRef?: RefObject<HTMLDivElement | null> }) {
  "use no memo"; // TanStack Virtual exposes mutable instance methods.
  const list = useRef<HTMLOListElement>(null);
  const selectedIndex = rows.findIndex(row => row.activity.id === selectedId);
  const tabStop = selectedIndex < 0 ? rows[0]?.activity.id : selectedId;
  const virtual = rows.length > 200 && Boolean(scrollRef);
  // eslint-disable-next-line react-hooks/incompatible-library -- This component opts out of compiler memoization for the virtualizer.
  const virtualizer = useVirtualizer({ count: rows.length, enabled: virtual, getScrollElement: () => scrollRef?.current ?? null, estimateSize: () => 168, getItemKey: index => rows[index].activity.id, overscan: 4, initialRect: { width: 0, height: 416 }, rangeExtractor: range => { const visible = defaultRangeExtractor(range); return selectedIndex < 0 || visible.includes(selectedIndex) ? visible : [...visible, selectedIndex].sort((a, b) => a - b); } });
  useEffect(() => { if (virtual && selectedIndex >= 0) virtualizer.scrollToIndex(selectedIndex, { align: "auto" }); }, [selectedId, selectedIndex, virtual, virtualizer]);
  const rendered = virtual ? virtualizer.getVirtualItems() : rows.map((row, index) => ({ key: row.activity.id, index, start: 0 }));
  return <ol ref={list} aria-label="Activity feed" className="relative divide-y divide-border" style={virtual ? { height: virtualizer.getTotalSize() } : undefined} onKeyDown={event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-activity-id]");
    if (!target || disabled || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    let id: string | undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") id = adjacentActivityId(rows, target.dataset.activityId ?? "", event.key === "ArrowDown" ? 1 : -1);
    else if (event.key === "Home") id = rows[0]?.activity.id;
    else if (event.key === "End") id = rows.at(-1)?.activity.id;
    else if (event.key === "Enter") { event.preventDefault(); onSelect(target.dataset.activityId!); onOpen(); return; }
    else return;
    event.preventDefault();
    if (id) {
      onSelect(id);
      // Selection pins the destination during the React commit, including End.
      requestAnimationFrame(() => Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[data-activity-id]") ?? []).find(button => button.dataset.activityId === id)?.focus());
    }
  }}>{rendered.map(item => { const row = rows[item.index]; return <li key={row.activity.id} aria-posinset={item.index + 1} aria-setsize={rows.length} style={virtual ? { position: "absolute", top: item.start, left: 0, width: "100%", height: 168 } : undefined}>
    <ActivityFeedRow row={row} selected={row.activity.id === selectedId} tabStop={row.activity.id === tabStop} disabled={disabled} onSelect={onSelect} virtual={virtual} />
  </li>; })}</ol>;
}

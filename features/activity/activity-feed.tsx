"use client";

import { useRef } from "react";
import { displayTimestamp } from "../reviews/review-format";
import { adjacentActivityId, type ActivityRow } from "./activity-model";

export function ActivityFeed({ rows, selectedId, onSelect, onOpen, disabled = false }: { rows: ActivityRow[]; selectedId: string; onSelect: (id: string) => void; onOpen: () => void; disabled?: boolean }) {
  const list = useRef<HTMLOListElement>(null);
  const tabStop = rows.some(row => row.activity.id === selectedId) ? selectedId : rows[0]?.activity.id;
  return <ol ref={list} aria-label="Activity feed" className="divide-y divide-zinc-200" onKeyDown={event => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-activity-id]");
    if (!target || disabled) return;
    let id: string | undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") id = adjacentActivityId(rows, target.dataset.activityId ?? "", event.key === "ArrowDown" ? 1 : -1);
    else if (event.key === "Home") id = rows[0]?.activity.id;
    else if (event.key === "End") id = rows.at(-1)?.activity.id;
    else if (event.key === "Enter") { event.preventDefault(); onSelect(target.dataset.activityId!); onOpen(); return; }
    else return;
    event.preventDefault();
    if (id) {
      onSelect(id);
      Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button[data-activity-id]") ?? []).find(button => button.dataset.activityId === id)?.focus();
    }
  }}>{rows.map(({ activity, account, deal }) => <li key={activity.id}>
    <button type="button" data-activity-id={activity.id} tabIndex={activity.id === tabStop ? 0 : -1} aria-current={activity.id === selectedId ? "true" : undefined} disabled={disabled} onClick={() => onSelect(activity.id)} className={`block w-full border-l-2 px-3 py-3 text-left focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 ${activity.id === selectedId ? "border-indigo-600 bg-indigo-50/60" : "border-transparent hover:bg-zinc-50"}`}>
      <span className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-500"><span className="font-semibold uppercase tracking-wide">{activity.type}</span><time dateTime={activity.occurredAt}>{displayTimestamp(activity.occurredAt)}</time></span>
      <span className="mt-1 block text-xs font-semibold text-zinc-900">{activity.title}</span>
      <span className="mt-1 block text-[11px] text-zinc-600">{account?.name ?? "Unavailable account"}{activity.dealId && <span className="block truncate text-zinc-500">{deal?.title ?? "Unavailable deal"}</span>}</span>
      <span className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{activity.summary}</span>
    </button>
  </li>)}</ol>;
}

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EntityIcon } from "../../components/shared/entity-icon";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { buildSearchIndex, searchIndex, type SearchEntry } from "./search-index";
import { useSearchData } from "./use-search-data";

const resultIcons = { Accounts: "account", Contacts: "contact", Deals: "deal", Reviews: "review", Activities: "activity" } as const;

export function SearchResults({ results, selectedKey, onSelect, listId }: { results: ReturnType<typeof searchIndex>; selectedKey?: string; onSelect: (entry: SearchEntry) => void; listId: string }) {
  return <div id={listId} role="listbox" aria-label="Workspace search results" className="max-h-[min(24rem,45dvh)] overflow-auto">
    {results.groups.map(group => <div key={group.name} role="group" aria-label={`${group.name}, showing ${group.entries.length} of ${group.total}`}><div aria-hidden="true" className="sticky top-0 z-10 flex justify-between border-y border-border bg-bg-subtle px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted"><span>{group.name}</span><span>{group.entries.length} / {group.total}</span></div>
      {group.entries.map(entry => <div key={entry.key} id={`${listId}-${encodeURIComponent(entry.key)}`} role="option" aria-selected={entry.key === selectedKey} onMouseDown={event => event.preventDefault()} onClick={() => onSelect(entry)} className={`search-option cursor-pointer border-l-2 px-2 py-2 text-xs ${entry.key === selectedKey ? "border-accent bg-accent-soft text-accent" : "border-transparent hover:bg-bg-subtle"}`}>
        <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 break-words font-medium"><EntityIcon type={resultIcons[entry.group]} className="size-3.5 shrink-0" />{entry.label}</span><span className="shrink-0 text-[10px] text-text-muted">{entry.group}</span></div><p title={entry.context} className="mt-0.5 truncate text-[11px] text-text-muted">{entry.context || "No additional details"}</p><p className="mt-0.5 text-[10px] text-text-muted">{entry.metadata}</p>
      </div>)}
    </div>)}
  </div>;
}

export function CommandPalette({ onClose, navigate, restoreFocus }: { onClose: () => void; navigate: (href: string) => void; restoreFocus: () => void }) {
  const { accounts, contacts, deals, proposals, activities } = useSearchData();
  const queries = [accounts, contacts, deals, proposals, activities];
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<string>();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const ready = queries.every(query => query.data !== undefined);
  const failed = queries.some(query => query.isError);
  const index = useMemo(() => buildSearchIndex({ accounts: accounts.data ?? [], contacts: contacts.data ?? [], deals: deals.data ?? [], proposals: proposals.data ?? [], activities: activities.data ?? [] }), [accounts.data, contacts.data, deals.data, proposals.data, activities.data]);
  const results = useMemo(() => searchIndex(index, search), [index, search]);
  const entries = ready || failed ? results.entries : [];
  const selected = entries.find(entry => entry.key === selection) ?? entries[0];
  const selectedIndex = selected ? entries.indexOf(selected) : -1;
  // A closed native dialog cannot receive React's mount-time autoFocus.
  // This runs after the shared dialog's showModal effect.
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (selected) document.getElementById(`${listId}-${encodeURIComponent(selected.key)}`)?.scrollIntoView({ block: "nearest" });
  }, [selected?.key, listId, selected]);
  return <WorkspaceDialog title="Search workspace" onClose={onClose} restoreFocus={restoreFocus} onKeyDown={event => {
    // Search inputs otherwise consume Escape to clear their value before dialog cancel.
    if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); onClose(); }
  }}>
    <label className="sr-only" htmlFor={`${listId}-input`}>Search accounts, contacts, deals, reviews and activities</label>
    <input ref={input} id={`${listId}-input`} autoFocus type="search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={listId} aria-activedescendant={selected ? `${listId}-${encodeURIComponent(selected.key)}` : undefined} aria-describedby={`${listId}-status`} placeholder="Search accounts, contacts, deals, reviews, activities…" value={search} onChange={event => { setSearch(event.target.value); setSelection(undefined); list.current?.scrollTo(0, 0); }} className="h-9 w-full rounded-sm border border-border-strong px-3 text-xs" onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const next = entries[Math.max(0, Math.min(entries.length - 1, selectedIndex + (event.key === "ArrowDown" ? 1 : -1)))]; setSelection(next?.key); }
      if (event.key === "Enter") { event.preventDefault(); if (selected && !event.repeat) navigate(selected.href); }
    }} />
    <p id={`${listId}-status`} role="status" className="my-2 text-[11px] text-text-muted">{!ready && !failed ? "Loading local workspace records…" : `${entries.length} shown of ${results.total} matches`}</p>
    {failed && <div role="alert" className="mb-2 flex items-center gap-2 border border-danger-border bg-danger-soft p-2 text-xs text-danger"><span>Some local data could not be loaded. Results may be incomplete.</span><button type="button" disabled={queries.some(query => query.isFetching)} onClick={() => { for (const query of queries) void query.refetch(); }} className="rounded-sm underline">Retry</button></div>}
    <div ref={list}><SearchResults results={!ready && !failed ? { groups: [], entries: [], total: 0 } : results} selectedKey={selected?.key} onSelect={entry => navigate(entry.href)} listId={listId} /></div>
    {(ready || failed) && !entries.length && <p className="py-5 text-center text-xs text-text-muted">{index.length ? "No matches. Try a shorter name, field or phrase." : "No searchable records available in this workspace."}</p>}
    <p className="mt-3 border-t border-border pt-2 text-[10px] text-text-muted">↑ ↓ Select · Enter Open · Esc Close · Ctrl / ⌘ K Toggle · Up to 6 per type; type more to narrow results.</p>
  </WorkspaceDialog>;
}

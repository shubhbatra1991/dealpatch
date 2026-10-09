"use client";

import Link from "next/link";
import { useState } from "react";
import type { SavedView } from "../../domain/saved-views/saved-view";
import { SavedViewDialog } from "./saved-view-dialog";
import { useSavedViews } from "./use-saved-views";

export const savedViewHref = (id: string) => `/pipeline?view=${encodeURIComponent(id)}`;

export function SavedViewsSection() {
  const views = useSavedViews();
  const [editing, setEditing] = useState<{ action: "rename" | "delete"; view: SavedView; opener?: HTMLElement }>();
  return <section aria-labelledby="saved-views-label" className="border-t border-zinc-200 pt-4"><h2 id="saved-views-label" tabIndex={-1} className="px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500"><span className="sr-only sm:not-sr-only">Saved views</span><span aria-hidden="true" className="sm:hidden">≡</span></h2>
    {views.isError ? <p role="alert" className="px-2 pt-2 text-xs text-red-900">Saved views unavailable. <button type="button" onClick={() => void views.refetch()} className="underline">Retry</button></p>
      : !views.data ? <p role="status" className="px-2 pt-2 text-xs text-zinc-500">Loading saved views…</p>
      : !views.data.length ? <p className="px-2 pt-2 text-xs text-zinc-500"><span className="sr-only sm:not-sr-only">No saved views yet</span><span aria-hidden="true" className="sm:hidden">—</span></p>
      : <ul aria-label="Pipeline saved views" className="mt-2 space-y-1">{views.data.map(view => <li key={view.id} className="flex items-center gap-1"><Link href={savedViewHref(view.id)} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && window.location.pathname + window.location.search === savedViewHref(view.id)) { event.preventDefault(); window.location.reload(); } }} title={view.name} className="min-w-0 flex-1 truncate rounded-sm px-1 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200/50 sm:px-2"><span aria-hidden="true" className="text-zinc-500 sm:mr-2">≡</span><span className="sr-only sm:not-sr-only">{view.name}</span></Link><details className="relative" onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); } }}><summary aria-label={`Manage ${view.name}`} className="cursor-pointer list-none rounded-sm px-1 text-xs text-zinc-500">•••</summary><div className="absolute bottom-full left-0 z-30 mb-1 w-8 rounded-sm border border-zinc-200 bg-white p-1 shadow-sm sm:right-0 sm:left-auto sm:w-28">{(["rename", "delete"] as const).map(action => <button key={action} aria-label={`${action === "rename" ? "Rename" : "Delete"} ${view.name}`} type="button" className="block w-full rounded-sm px-1 py-1.5 text-center sm:px-2 sm:text-left text-xs text-zinc-700 hover:bg-zinc-100" onClick={event => { const menu = event.currentTarget.closest("details"); const opener = menu?.querySelector("summary") ?? undefined; if (menu) menu.open = false; setEditing({ action, view, opener }); }}><span className="sr-only sm:not-sr-only">{action === "rename" ? "Rename" : "Delete"}</span><span aria-hidden="true" className="sm:hidden">{action === "rename" ? "R" : "×"}</span></button>)}</div></details></li>)}</ul>}
    {editing && <SavedViewDialog action={editing.action} view={editing.view} onClose={() => setEditing(undefined)} restoreFocus={() => { if (editing.opener?.isConnected) editing.opener.focus(); else document.getElementById("saved-views-label")?.focus(); }} />}
  </section>;
}

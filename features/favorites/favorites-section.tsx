"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutationState } from "@tanstack/react-query";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { queryKeys } from "../../lib/query/keys";
import { useAccounts } from "../accounts/use-accounts";
import { useContacts } from "../contacts/use-contacts";
import { useDeals } from "../pipeline/use-deals";
import { FavoriteButton } from "./favorite-button";
import { favoriteTypeLabels, resolveFavorites, type FavoriteRecord } from "./favorites-model";
import { useFavorites } from "./use-favorites";
import { EntityIcon } from "../../components/shared/entity-icon";

export function FavoriteList({ records, expanded = false, onNavigate }: { records: FavoriteRecord[]; expanded?: boolean; onNavigate?: () => void }) {
  return <ul aria-label="Favorite records" className="mt-2 space-y-1">{records.map(({ favorite, name, href }) => <li key={favorite.id} className="flex min-w-0 items-center gap-1">
    {href ? <Link href={href} onClick={onNavigate} title={`${favoriteTypeLabels[favorite.entityType]}: ${name}`} className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-text hover:bg-surface-muted/50 focus-visible:outline-2 focus-visible:outline-focus-ring ${expanded ? "" : "justify-center sm:justify-start"}`}><EntityIcon type={favorite.entityType} className="size-3.5 shrink-0 text-text-muted" /><span className={expanded ? "truncate" : "sr-only truncate sm:not-sr-only"}><span className="sr-only">{favoriteTypeLabels[favorite.entityType]}: </span>{name}</span></Link>
      : <span className="min-w-0 flex-1 px-2 text-xs text-text-muted"><span className={expanded ? "" : "sr-only sm:not-sr-only"}>{name}</span><span aria-hidden="true" className="sm:hidden">?</span></span>}
    {(expanded || !href) && <FavoriteButton entityType={favorite.entityType} entityId={favorite.entityId} recordName={name} />}
  </li>)}</ul>;
}

function FavoriteRecords() {
  const favorites = useFavorites();
  const accounts = useAccounts();
  const contacts = useContacts();
  const deals = useDeals();
  const [expanded, setExpanded] = useState(false);
  const failed = accounts.isError || contacts.isError || deals.isError;
  if (failed) return <div role="alert" className="px-2 pt-2 text-xs text-danger">Favorite records could not be loaded. <button type="button" className="underline" onClick={() => { void accounts.refetch(); void contacts.refetch(); void deals.refetch(); }}>Retry</button></div>;
  if (!accounts.data || !contacts.data || !deals.data) return <p role="status" className="px-2 pt-2 text-xs text-text-muted">Loading favorites…</p>;
  const records = resolveFavorites(favorites.data ?? [], accounts.data, contacts.data, deals.data);
  return <><FavoriteList records={records.slice(0, 5)} />{records.length > 5 && <button type="button" onClick={() => setExpanded(true)} className="mt-2 rounded-sm px-2 py-1 text-xs text-text-muted underline focus-visible:outline-2 focus-visible:outline-focus-ring"><span className="sr-only sm:not-sr-only">View all favorites</span><span aria-hidden="true" className="sm:hidden">•••</span></button>}
    {expanded && <WorkspaceDialog title="All favorites" onClose={() => setExpanded(false)}>{records.length ? <FavoriteList records={records} expanded onNavigate={() => setExpanded(false)} /> : <p className="text-xs text-text-muted">No favorites yet</p>}</WorkspaceDialog>}
  </>;
}

export function FavoritesSection() {
  const favorites = useFavorites();
  // Keep a failed removal visible even if its optimistic update unmounted the star.
  const latestWrite = useMutationState({ filters: { mutationKey: queryKeys.favorites.writes }, select: mutation => mutation.state }).at(-1);
  return <section aria-labelledby="favorites-label" className="border-t border-border pt-4"><h2 id="favorites-label" className="px-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted"><span className="sr-only sm:not-sr-only">Favorites</span><span aria-hidden="true" className="sm:hidden">★</span></h2>
    {latestWrite?.status === "error" && <p role="alert" className="px-2 pt-2 text-xs text-danger">Favorite could not be saved. Your previous favorites were restored.</p>}
    {favorites.isError ? <p role="alert" className="px-2 pt-2 text-xs text-danger">Favorites unavailable. <button type="button" onClick={() => void favorites.refetch()} className="underline">Retry</button></p>
      : !favorites.data ? <p role="status" className="px-2 pt-2 text-xs text-text-muted">Loading favorites…</p>
      : favorites.data.length ? <FavoriteRecords /> : <p className="px-2 pt-2 text-xs text-text-muted"><span className="sr-only sm:not-sr-only">No favorites yet</span><span aria-hidden="true" className="sm:hidden">—</span></p>}
  </section>;
}

"use client";

import { FiStar } from "react-icons/fi";

import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FavoriteTarget } from "../../domain/favorites/favorite";
import { queryKeys } from "../../lib/query/keys";
import { favoriteMutationOptions, sameFavorite, useFavorites } from "./use-favorites";

export function FavoriteButton({ recordName, ...target }: FavoriteTarget & { recordName?: string }) {
  const favorites = useFavorites();
  const mutation = useMutation(favoriteMutationOptions(useQueryClient(), target));
  const busy = useIsMutating({ mutationKey: queryKeys.favorites.write(target.entityType, target.entityId), exact: true }) > 0;
  const selected = favorites.data?.some(record => sameFavorite(record, target)) ?? false;
  const label = recordName ? selected ? `Remove ${recordName} from favorites` : `Add ${recordName} to favorites` : selected ? "Remove from favorites" : "Add to favorites";
  return <span className="inline-flex flex-wrap items-center gap-2">
    <button type="button" aria-label={label} title={label} aria-pressed={selected} aria-busy={busy} disabled={!favorites.data || busy} onClick={() => mutation.mutate(!selected)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface text-lg leading-none text-text hover:enabled:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:border-dashed"><FiStar aria-hidden="true" className="size-4" fill={selected ? "currentColor" : "none"} strokeWidth={1.5} /></button>
    {(mutation.isError || favorites.isError) && <span role="alert" className="max-w-60 text-[11px] text-danger">{mutation.isError ? `Favorite could not be saved. ${mutation.error.message}` : "Favorites could not be loaded."}{favorites.isError && <button type="button" onClick={() => void favorites.refetch()} className="ml-1 rounded-sm underline">Retry</button>}</span>}
  </span>;
}

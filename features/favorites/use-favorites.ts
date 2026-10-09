"use client";

import { isServer, mutationOptions, queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import type { Favorite, FavoriteTarget } from "../../domain/favorites/favorite";
import { favoriteTargetSchema } from "../../domain/favorites/schema";
import { favoriteRepository, type FavoriteRepository } from "../../lib/repositories/favorites";
import { queryKeys } from "../../lib/query/keys";

export const favoritesOptions = queryOptions({ queryKey: queryKeys.favorites.list, queryFn: () => favoriteRepository.getAll(), enabled: !isServer });
export const useFavorites = () => useQuery(favoritesOptions);
export const sameFavorite = (record: FavoriteTarget, target: FavoriteTarget) => record.entityType === target.entityType && record.entityId === target.entityId;
const writes = new WeakMap<QueryClient, Set<string>>();

/** Patch one target, preserving other simultaneous favorite changes. */
function replaceFavorite(client: QueryClient, target: FavoriteTarget, favorite?: Favorite) {
  client.setQueryData<Favorite[]>(queryKeys.favorites.list, current => current && [...current.filter(record => !sameFavorite(record, target)), ...(favorite ? [favorite] : [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)));
}

export function favoriteMutationOptions(client: QueryClient, input: FavoriteTarget, persistence: FavoriteRepository = favoriteRepository) {
  const target = favoriteTargetSchema.parse(input);
  const key = JSON.stringify([target.entityType, target.entityId]);
  async function release() {
    const pending = writes.get(client);
    pending?.delete(key);
    // A refetch must not erase another record's pending optimistic star.
    if (!pending?.size) await client.invalidateQueries({ queryKey: queryKeys.favorites.list });
  }
  return mutationOptions({
    mutationKey: queryKeys.favorites.write(target.entityType, target.entityId),
    retry: false,
    mutationFn: (enabled: boolean) => persistence.setFavorite(target, enabled),
    onMutate: async (enabled: boolean) => {
      const pending = writes.get(client) ?? new Set<string>();
      if (pending.has(key)) throw new Error("This favorite is still being saved.");
      pending.add(key); writes.set(client, pending);
      try {
        await client.cancelQueries({ queryKey: queryKeys.favorites.list });
        const records = client.getQueryData<Favorite[]>(queryKeys.favorites.list);
        if (!records) throw new Error("Favorites are still loading. Please try again.");
        const previous = records.find(record => sameFavorite(record, target));
        replaceFavorite(client, target, enabled ? previous ?? { ...target, id: crypto.randomUUID(), createdAt: new Date().toISOString() } : undefined);
        return { previous };
      } catch (error) { await release(); throw error; }
    },
    onSuccess: favorite => replaceFavorite(client, target, favorite),
    onError: (_error, _enabled, context) => { if (context) replaceFavorite(client, target, context.previous); },
    onSettled: async (_data, _error, _enabled, context) => { if (context) await release(); },
  });
}

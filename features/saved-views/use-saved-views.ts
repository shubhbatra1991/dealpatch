"use client";

import { isServer, mutationOptions, queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";
import type { PipelineViewConfig, SavedView } from "../../domain/saved-views/saved-view";
import { queryKeys } from "../../lib/query/keys";
import { savedViewRepository, type SavedViewRepository } from "../../lib/repositories/saved-views";

export const savedViewsOptions = queryOptions({ queryKey: queryKeys.savedViews.list, queryFn: () => savedViewRepository.getAll(), enabled: !isServer });
export const useSavedViews = () => useQuery(savedViewsOptions);
export type SavedViewWrite = { action: "create"; config: PipelineViewConfig; name: string } | { action: "rename"; id: string; name: string } | { action: "delete"; id: string };

export function savedViewMutationOptions(client: QueryClient, repository: SavedViewRepository = savedViewRepository) {
  return mutationOptions({
    mutationFn: async (write: SavedViewWrite) => {
      if (write.action === "create") return repository.create({ ...write.config, entityType: "pipeline", name: write.name });
      if (write.action === "rename") return repository.rename(write.id, write.name);
      await repository.delete(write.id);
      return undefined;
    },
    onSuccess: (view, write) => {
      client.setQueryData<SavedView[]>(queryKeys.savedViews.list, current => {
        const remaining = (current ?? []).filter(record => record.id !== (view?.id ?? (write.action === "delete" ? write.id : undefined)));
        return [...remaining, ...(view ? [view] : [])].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.savedViews.list }),
  });
}

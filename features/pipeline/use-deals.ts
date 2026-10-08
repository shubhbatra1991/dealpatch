"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { dealRepository } from "../../lib/repositories/deals";

export const dealsQueryOptions = queryOptions({
  queryKey: queryKeys.deals.list,
  queryFn: () => dealRepository.getAll(),
  enabled: !isServer,
});

export function useDeals() {
  return useQuery(dealsQueryOptions);
}

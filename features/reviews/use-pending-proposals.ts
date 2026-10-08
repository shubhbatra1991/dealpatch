"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { proposalRepository } from "../../lib/repositories/proposals";

export const pendingProposalsQueryOptions = queryOptions({
  queryKey: queryKeys.proposals.pending,
  queryFn: () => proposalRepository.getPending(),
  enabled: !isServer,
});

export function usePendingProposals() {
  return useQuery(pendingProposalsQueryOptions);
}

"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { proposalRepository } from "../../lib/repositories/proposals";

export const allProposalsOptions = queryOptions({ queryKey: queryKeys.proposals.list, queryFn: () => proposalRepository.getAll(), enabled: !isServer });
export function useAllProposals() { return useQuery(allProposalsOptions); }

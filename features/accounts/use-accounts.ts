"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { accountRepository } from "../../lib/repositories/accounts";

export const accountsQueryOptions = queryOptions({
  queryKey: queryKeys.accounts.list,
  queryFn: () => accountRepository.getAll(),
  enabled: !isServer,
});

export function useAccounts() {
  return useQuery(accountsQueryOptions);
}

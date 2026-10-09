"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { contactRepository } from "../../lib/repositories/contacts";
import { useAccounts } from "../accounts/use-accounts";
import { useDeals } from "../pipeline/use-deals";
import { useActivities } from "../activity/use-activities";
import { usePendingProposals } from "../reviews/use-pending-proposals";

export const contactsQueryOptions = queryOptions({ queryKey: queryKeys.contacts.list, queryFn: () => contactRepository.getAll(), enabled: !isServer });
export const useContacts = () => useQuery(contactsQueryOptions);
export function useContactCore() {
  return { contacts: useContacts(), accounts: useAccounts(), deals: useDeals(), activities: useActivities() };
}
export function useContactDirectory() {
  return { ...useContactCore(), proposals: usePendingProposals() };
}

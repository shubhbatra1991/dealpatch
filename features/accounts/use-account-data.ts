"use client";

import { isServer, queryOptions, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { contactRepository } from "../../lib/repositories/contacts";
import { proposalRepository } from "../../lib/repositories/proposals";
import { auditRepository } from "../../lib/repositories/audit";
import { useDeals } from "../pipeline/use-deals";
import { useActivities } from "../activity/use-activities";
import { useAccounts } from "./use-accounts";

export function accountContactsOptions(accountId: string) {
  return queryOptions({ queryKey: queryKeys.contacts.forAccount(accountId), queryFn: () => contactRepository.getByAccountId(accountId), enabled: !isServer });
}
export function accountProposalsOptions(accountId: string) {
  return queryOptions({ queryKey: queryKeys.proposals.forAccount(accountId), queryFn: () => proposalRepository.getByAccountId(accountId), enabled: !isServer });
}
export function accountAuditOptions(accountId: string) {
  return queryOptions({ queryKey: queryKeys.audit.forAccount(accountId), queryFn: () => auditRepository.getByAccountId(accountId), enabled: !isServer });
}
/** Reuse the same caches as Pipeline, Overview and review mutations. */
export function useAccountCore() {
  return { accounts: useAccounts(), deals: useDeals(), activities: useActivities() };
}
export const useAccountContacts = (accountId: string) => useQuery(accountContactsOptions(accountId));
export const useAccountProposals = (accountId: string) => useQuery(accountProposalsOptions(accountId));
export const useAccountAudit = (accountId: string) => useQuery(accountAuditOptions(accountId));

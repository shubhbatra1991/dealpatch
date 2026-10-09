"use client";

import { useContactCore } from "../contacts/use-contacts";
import { useAccountAudit, useAccountProposals } from "../accounts/use-account-data";

/** Share the same entity caches used by Pipeline, Contacts and optimistic review writes. */
export function useDealDetailData(dealId: string) {
  const core = useContactCore();
  const deal = core.deals.data?.find(record => record.id === dealId);
  const proposals = useAccountProposals(deal?.accountId ?? "");
  const audit = useAccountAudit(deal?.accountId ?? "");
  return { ...core, deal, proposals, audit };
}

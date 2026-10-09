import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import type { Account } from "../../domain/accounts/account";
import type { Deal } from "../../domain/deals/deal";
import type { Activity } from "../../domain/activities/activity";
import type { Proposal } from "../../domain/proposals/proposal";
import { isProposalChangeStale, isUnreviewed } from "../../domain/proposals/review";
import { queryKeys } from "../../lib/query/keys";
import { proposalRepository, type ProposalRepository } from "../../lib/repositories/proposals";
import type { ReviewItem } from "../../lib/repositories/reviews";
import { acquireReviewWrite, finishReviewWrite, reviewWriteKey } from "../reviews/approval-mutations";

export function queueProposalOptions(client: QueryClient, repository: Pick<ProposalRepository, "queueGenerated"> = proposalRepository) {
  return mutationOptions({
    mutationKey: [...reviewWriteKey, "generated"],
    mutationFn: (proposal: Proposal) => repository.queueGenerated(proposal),
    onMutate: async () => {
      acquireReviewWrite(client);
      await client.cancelQueries({ queryKey: queryKeys.proposals.all });
      return true;
    },
    onSuccess: ({ proposal }) => {
      const pending = ["Pending", "PartiallyApproved"].includes(proposal.status) && proposal.changes.some(isUnreviewed);
      const upsert = (items: Proposal[] | undefined, include = true) => items && [...items.filter(item => item.id !== proposal.id), ...(include ? [proposal] : [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      client.setQueryData<Proposal[]>(queryKeys.proposals.list, items => upsert(items));
      client.setQueryData<Proposal[]>(queryKeys.proposals.pending, items => upsert(items, pending));
      client.setQueryData<Proposal[]>(queryKeys.proposals.forAccount(proposal.accountId), items => upsert(items)?.reverse());
      const deal = client.getQueryData<Deal[]>(queryKeys.deals.list)?.find(item => item.id === proposal.dealId);
      const account = client.getQueryData<Account[]>(queryKeys.accounts.list)?.find(item => item.id === proposal.accountId);
      const source = client.getQueryData<Activity[]>(queryKeys.activities.list)?.find(item => item.id === proposal.sourceActivityId);
      // Generated suggestions target the selected deal. Leave absent caches for refetch,
      // rather than publishing an incomplete workspace or fabricated target values.
      if (deal && account && proposal.changes.every(change => change.entityType === "Deal" && change.entityId === deal.id)) {
        const item: ReviewItem = { proposal, account: account.name, deal: deal.title, source, changes: proposal.changes.map(change => {
          const current: unknown = Reflect.get(deal, change.field) ?? null;
          return { change, current, target: `Deal · ${deal.title}`, conflict: isUnreviewed(change) && isProposalChangeStale(change, current) };
        }) };
        for (const key of [queryKeys.proposals.queue, queryKeys.proposals.reviewItems]) {
          client.setQueryData<ReviewItem[]>(key, items => items && [...items.filter(item => item.proposal.id !== proposal.id), ...(pending || key === queryKeys.proposals.reviewItems ? [item] : [])].sort((a, b) => a.proposal.createdAt.localeCompare(b.proposal.createdAt)));
        }
      }
    },
    onSettled: async (_data, _error, _variables, acquired) => {
      if (acquired) await finishReviewWrite(client);
    },
  });
}

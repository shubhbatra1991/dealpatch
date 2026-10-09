import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { ZodError } from "zod";
import type { Proposal } from "../../domain/proposals/proposal";
import { queryKeys } from "../../lib/query/keys";
import { reviewRepository, type ReviewAction, type ReviewItem } from "../../lib/repositories/reviews";
import { acquireReviewWrite, finishReviewWrite, reviewWriteKey } from "./approval-mutations";
import { isPendingReview } from "./review-model";

type Request = { id: string; action: Exclude<ReviewAction, { type: "approve" }>; expectedProposal: Proposal };

/** Publish a validated decision before refetch, including the shell's pending badge. */
export function reviewActionMutationOptions(client: QueryClient, repository: Pick<typeof reviewRepository, "review"> = reviewRepository) {
  return mutationOptions({
    mutationKey: [...reviewWriteKey, "review"],
    onMutate: async () => {
      acquireReviewWrite(client);
      await client.cancelQueries({ queryKey: queryKeys.proposals.all });
      return true;
    },
    mutationFn: async ({ id, action, expectedProposal }: Request) => {
      try { return await repository.review(id, action, expectedProposal); }
      catch (error) {
        if (error instanceof ZodError) throw new Error(error.issues.map(issue => issue.message).join(" "));
        throw error;
      }
    },
    onSuccess: proposal => {
      client.setQueriesData<Proposal[]>({ queryKey: queryKeys.proposals.all, predicate: query => !["queue", "reviewItems"].includes(String(query.queryKey[1])) }, items => items?.map(item => item.id === proposal.id ? proposal : item));
      client.setQueryData<Proposal[]>(queryKeys.proposals.pending, items => items?.filter(isPendingReview));
      for (const key of [queryKeys.proposals.queue, queryKeys.proposals.reviewItems]) {
        client.setQueryData<ReviewItem[]>(key, items => items?.map(item => item.proposal.id !== proposal.id ? item : { ...item, proposal, changes: item.changes.map(row => ({ ...row, change: proposal.changes.find(change => change.id === row.change.id)! })) }).filter(item => key === queryKeys.proposals.reviewItems || isPendingReview(item.proposal)));
      }
    },
    onSettled: async (_data, _error, variables, acquired) => { if (acquired) await finishReviewWrite(client, [], variables.expectedProposal.accountId); },
  });
}

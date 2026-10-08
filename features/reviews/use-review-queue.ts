"use client";

import { isServer, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { reviewRepository, type ReviewAction } from "../../lib/repositories/reviews";
import { ZodError } from "zod";
import { acquireReviewWrite, approvalMutationOptions, finishReviewWrite, reviewWriteKey } from "./approval-mutations";

export const reviewQueueOptions = queryOptions({
  queryKey: queryKeys.proposals.queue,
  queryFn: () => reviewRepository.getQueue(),
  enabled: !isServer,
});
export const useReviewQueue = () => useQuery(reviewQueueOptions);

export function useApproveProposal() {
  return useMutation(approvalMutationOptions(useQueryClient()));
}

export function useReviewAction() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...reviewWriteKey, "review"],
    onMutate: () => { acquireReviewWrite(client); return true; },
    mutationFn: async ({ id, action }: { id: string; action: Exclude<ReviewAction, { type: "approve" }> }) => {
      try { return await reviewRepository.review(id, action); }
      catch (error) {
        if (error instanceof ZodError) throw new Error(error.issues.map(issue => issue.message).join(" "));
        throw error;
      }
    },
    onSettled: async (_data, _error, _variables, acquired) => { if (acquired) await finishReviewWrite(client); },
  });
}

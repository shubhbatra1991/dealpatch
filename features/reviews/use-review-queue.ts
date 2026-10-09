"use client";

import { isServer, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../lib/query/keys";
import { reviewRepository } from "../../lib/repositories/reviews";
import { approvalMutationOptions } from "./approval-mutations";
import { reviewActionMutationOptions } from "./review-action-mutations";

export const reviewQueueOptions = queryOptions({
  queryKey: queryKeys.proposals.queue,
  queryFn: () => reviewRepository.getQueue(),
  enabled: !isServer,
});
export const useReviewQueue = () => useQuery(reviewQueueOptions);
export const reviewItemsOptions = queryOptions({ queryKey: queryKeys.proposals.reviewItems, queryFn: () => reviewRepository.getAll(), enabled: !isServer });
export const useReviewItems = () => useQuery(reviewItemsOptions);

export function useApproveProposal() {
  return useMutation(approvalMutationOptions(useQueryClient()));
}

export function useReviewAction() {
  const client = useQueryClient();
  return useMutation(reviewActionMutationOptions(client));
}

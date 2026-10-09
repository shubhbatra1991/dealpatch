"use client";

import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import type { ReviewItem } from "../../lib/repositories/reviews";
import { isUnreviewed } from "../../domain/proposals/review";
import { reviewWriteKey } from "./approval-mutations";
import { useApproveProposal, useReviewAction } from "./use-review-queue";

export function useReviewCardActions(item: ReviewItem, onReviewed: (message: string) => void) {
  const approval = useApproveProposal();
  const review = useReviewAction();
  const busy = useIsMutating({ mutationKey: reviewWriteKey }) > 0;
  const [error, setError] = useState("");
  return {
    isPending: busy, error,
    async approve(changeIds: string[]) {
      setError("");
      onReviewed(`Applying ${changeIds.length} changes for ${item.account}…`);
      try {
        const receipt = await approval.mutateAsync({ id: item.proposal.id, changeIds, expectedProposal: item.proposal });
        const remaining = receipt.after.changes.filter(isUnreviewed).length;
        onReviewed(`Approved ${changeIds.length} changes for ${item.account}. ${remaining ? `${remaining} remaining changes await review.` : "Proposal complete."} Undo is available in the notification.`);
      } catch {
        // The global mutation notification remains mounted even if the card disappeared.
        onReviewed("Approval failed. The previous values and proposal have been restored. See the error notification.");
      }
    },
    async reject() {
      setError("");
      try {
        await review.mutateAsync({ id: item.proposal.id, action: { type: "reject" } });
        onReviewed(`Rejected remaining changes for ${item.account}. CRM data was not changed.`);
      } catch (error) { setError(error instanceof Error ? error.message : "Rejection failed. Try again."); }
    },
    async save(changeId: string, value: unknown) {
      setError("");
      await review.mutateAsync({ id: item.proposal.id, action: { type: "edit", changeId, value } });
    },
  };
}

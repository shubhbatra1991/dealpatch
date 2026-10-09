import { isUnreviewed } from "../../domain/proposals/review";
import type { Proposal } from "../../domain/proposals/proposal";
import type { ReviewItem } from "../../lib/repositories/reviews";

export const reviewFilters = ["Pending work", "All", "Approved", "Partially approved", "Rejected", "Superseded", "Stale"] as const;
export type ReviewFilter = typeof reviewFilters[number];
export const proposalStatusLabel = (status: Proposal["status"]) => status === "PartiallyApproved" ? "Partially approved" : status;
export const isPendingReview = (proposal: Proposal) => ["Pending", "PartiallyApproved"].includes(proposal.status) && proposal.changes.some(isUnreviewed);
export const staleChangeCount = (item: ReviewItem) => isPendingReview(item.proposal) ? item.changes.filter(change => isUnreviewed(change.change) && change.conflict).length : 0;

export function filterReviewItems(items: ReviewItem[], filter: ReviewFilter) {
  return items.filter(item => filter === "All" || (filter === "Pending work" ? isPendingReview(item.proposal) : filter === "Stale" ? staleChangeCount(item) > 0 : proposalStatusLabel(item.proposal.status) === filter));
}

/** A single snapshot supplies both the selected detail and navigation order. */
export function selectedReview(items: ReviewItem[], visible: ReviewItem[], selectedId?: string) {
  return selectedId ? items.find(item => item.proposal.id === selectedId) : visible[0];
}

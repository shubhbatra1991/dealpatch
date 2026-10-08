import type { Proposal, ProposalStatus } from "./proposal";
import type { ProposalChange } from "./proposal-change";

export const isUnreviewed = (change: ProposalChange) => change.status === "Pending" || change.status === "Edited";

export function reviewedStatus(changes: ProposalChange[]): ProposalStatus {
  const remaining = changes.some(isUnreviewed);
  const approved = changes.some(c => c.status === "Approved");
  return remaining ? approved ? "PartiallyApproved" : "Pending" : changes.every(c => c.status === "Approved") ? "Approved" : approved ? "PartiallyApproved" : "Rejected";
}

export function proposalWithApproval(proposal: Proposal, changeIds: string[]): Proposal {
  const selected = new Set(changeIds);
  if (!selected.size || selected.size !== changeIds.length || [...selected].some(id => !proposal.changes.some(c => c.id === id && isUnreviewed(c)))) throw new Error("Select pending changes to approve.");
  const changes: ProposalChange[] = proposal.changes.map(c => selected.has(c.id) ? { ...c, status: "Approved", selected: false } : c);
  return { ...proposal, changes, status: reviewedStatus(changes) };
}

/** Session receipt: contains only the proposal and the exact approved field IDs. */
export interface ApprovalReceipt { before: Proposal; after: Proposal; changeIds: string[] }

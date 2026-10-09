import type { Proposal, ProposalStatus } from "./proposal";
import type { ProposalChange } from "./proposal-change";

export const isUnreviewed = (change: ProposalChange) => change.status === "Pending" || change.status === "Edited";

/** Optional fields serialize absence as null; participant arrays preserve order. */
export function isProposalChangeStale(change: ProposalChange, currentValue: unknown): boolean {
  const current = currentValue === undefined ? null : currentValue;
  const snapshot = change.before;
  if (Array.isArray(snapshot)) {
    return !Array.isArray(current) || current.length !== snapshot.length
      || snapshot.some((value, index) => current[index] !== value);
  }
  return current !== snapshot;
}

/** Call against freshly read data at application time, not only at generation. */
export function assertProposalChangeCurrent(change: ProposalChange, currentValue: unknown): void {
  if (isProposalChangeStale(change, currentValue)) {
    throw new Error("The proposal is stale: the current field value differs from its generation-time snapshot. Review the current and proposed values before applying.");
  }
}

export function reviewedStatus(changes: ProposalChange[]): ProposalStatus {
  const remaining = changes.some(isUnreviewed);
  const approved = changes.some(c => c.status === "Approved");
  return remaining ? approved ? "PartiallyApproved" : "Pending" : changes.every(c => c.status === "Approved") ? "Approved" : approved ? "PartiallyApproved" : "Rejected";
}

/** Updates review state only; does not apply values or bypass staleness checks. */
export function proposalWithApproval(proposal: Proposal, changeIds: string[]): Proposal {
  const selected = new Set(changeIds);
  if (!selected.size || selected.size !== changeIds.length || [...selected].some(id => !proposal.changes.some(c => c.id === id && isUnreviewed(c)))) throw new Error("Select pending changes to approve.");
  const changes: ProposalChange[] = proposal.changes.map(c => selected.has(c.id) ? { ...c, ...(c.status === "Edited" ? { edited: true } : {}), status: "Approved", selected: false } : c);
  return { ...proposal, changes, status: reviewedStatus(changes) };
}

/** Session receipt: contains only the proposal and the exact approved field IDs. */
export interface ApprovalReceipt { before: Proposal; after: Proposal; changeIds: string[] }

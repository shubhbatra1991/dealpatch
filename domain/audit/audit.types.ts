/** Machine values distinguish full and partial approval decisions. */
export type AuditAction =
  | "ProposalApproved"
  | "ProposalPartiallyApproved"
  | "ProposalRejected"
  | "FieldEdited"
  | "ApprovalUndone";

/**
 * Append-only historical fact. Undo creates another event, never rewrites this one.
 * All identifiers are opaque. proposalId is null for actions without a proposal.
 * These readonly types do not replace append-only enforcement at a write boundary.
 */
export interface AuditEvent {
  readonly id: string;
  /** Entity category is an open string in DATA_MODEL.md. */
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly previousValue: unknown;
  readonly nextValue: unknown;
  readonly proposalId: string | null;
  /** ISO 8601 datetime; display formatting belongs to the UI. */
  readonly occurredAt: string;
}

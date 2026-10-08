import type { ProposalChange } from "./proposal-change";

export type ProposalStatus =
  | "Pending"
  | "Approved"
  | "PartiallyApproved"
  | "Rejected"
  | "Superseded";

/** Informational source text, never executable content. */
export interface Evidence {
  type: "activity_excerpt";
  sourceActivityId: string;
  text: string;
}

/** Suggested changes only; approval/application is a separate workflow. */
export interface Proposal {
  id: string;
  accountId: string;
  dealId?: string;
  sourceActivityId: string;
  status: ProposalStatus;
  /** Informational percentage from 0 to 100; never authorizes application. */
  confidence: number;
  /** ISO 8601 datetime. */
  createdAt: string;
  changes: ProposalChange[];
  evidence: Evidence[];
}

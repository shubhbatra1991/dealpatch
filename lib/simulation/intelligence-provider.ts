import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Deal } from "../../domain/deals/deal";
import type { Proposal } from "../../domain/proposals/proposal";
import type { ProposalChange } from "../../domain/proposals/proposal-change";

export interface IntelligenceInput {
  activity: Activity;
  accounts: readonly Account[];
  deals: readonly Deal[];
}
type EventPayload =
  | { type: "activity_received"; activityId: string }
  | { type: "extracting_entities"; participantIds: string[]; signals: string[] }
  | { type: "matching_account"; account: Pick<Account, "id" | "name"> | null }
  | { type: "matching_deal"; deal: Pick<Deal, "id" | "title"> | null }
  | { type: "detecting_changes"; changes: ProposalChange[] }
  | { type: "evaluating_confidence"; confidence: number; basis: string }
  | { type: "proposal_generated"; proposal: Proposal }
  | { type: "analysis_completed"; reason: string };

export type IntelligenceEvent = EventPayload & { sequence: number; at: string };

/** Local demo contract. Reading a stream never writes CRM or proposal records. */
export interface IntelligenceProvider {
  readonly label: "Demo intelligence";
  analyze(input: IntelligenceInput, options?: { signal?: AbortSignal }): AsyncIterable<IntelligenceEvent>;
}

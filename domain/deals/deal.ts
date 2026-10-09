export type DealStage =
  | "Discovery"
  | "Evaluation"
  | "Proposal"
  | "Negotiation"
  | "ClosedWon"
  | "ClosedLost";

export type DealRisk = "Low" | "Medium" | "High";

/** ISO-style three-letter currency code, e.g. EUR, USD, or GBP. Validated at input boundaries. */
export type CurrencyCode = string;

export interface Deal {
  id: string;
  accountId: string;
  title: string;
  stage: DealStage;
  /** Non-negative amount in major currency units, e.g. 1250.50 EUR. */
  value: number;
  currency: CurrencyCode;
  /** Percentage from 0 to 100. */
  probability: number;
  /** ISO 8601 date (YYYY-MM-DD). */
  expectedCloseDate?: string;
  /** Demo ownership reference only; no User entity or access-control meaning. */
  ownerId: string;
  risk: DealRisk;
  nextStep?: string;
  /** ISO 8601 datetime. */
  lastActivityAt?: string;
}

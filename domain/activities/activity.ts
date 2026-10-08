export type ActivityType = "Meeting" | "Email" | "Call" | "Note";

export interface Activity {
  id: string;
  accountId: string;
  dealId?: string;
  type: ActivityType;
  title: string;
  summary: string;
  /** ISO 8601 datetime. */
  occurredAt: string;
  /** Contact IDs for participants associated with this activity. */
  participants?: string[];
}

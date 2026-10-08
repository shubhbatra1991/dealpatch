import type { ProposalChange } from "../../domain/proposals/proposal-change";

export const fieldLabel = (field: string) => field.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());
export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value)) return value.join(", ");
  if (value === "ClosedWon") return "Closed Won";
  if (value === "ClosedLost") return "Closed Lost";
  return String(value);
}
export const displayFieldValue = (field: string, value: unknown) => field === "probability" && typeof value === "number" ? `${value}%` : displayValue(value);
const timestamp = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
export const displayTimestamp = (value: string) => `${timestamp.format(new Date(value))} UTC`;

export function parseEdit(value: string, change: ProposalChange): unknown {
  if (value.trim() === "") return null;
  if (typeof change.after === "number" || typeof change.before === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("Enter a valid number.");
    return number;
  }
  if (typeof change.after === "boolean" || Array.isArray(change.after)) return JSON.parse(value);
  return value;
}
export function editorOptions(change: ProposalChange): string[] | undefined {
  if (change.field === "stage") return ["Discovery", "Evaluation", "Proposal", "Negotiation", "ClosedWon", "ClosedLost"];
  if (change.field === "risk") return ["Low", "Medium", "High"];
  if (change.field === "status") return change.entityType === "Account" ? ["Prospect", "Active", "Customer", "Dormant"] : ["Active", "Inactive"];
  if (change.field === "type") return ["Meeting", "Email", "Call", "Note"];
}

import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { AuditEvent } from "../../domain/audit/audit.types";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import { isTerminalDealStage } from "../../domain/deals/rules";
import type { Proposal } from "../../domain/proposals/proposal";
import { buildAccountDetail, isPendingProposal, latestTimestamp } from "../accounts/accounts-model";

export const dealHref = (id: string) => `/deals/${encodeURIComponent(id)}`;
export const dealTabs = ["Overview", "Activity", "Contacts", "Reviews", "Changes"] as const;
export type DealTab = typeof dealTabs[number];
const day = 86_400_000;

/** Reuse the account projection, then narrow to explicit opportunity relationships. */
export function buildDealDetail(deal: Deal, accounts: Account[], contacts: Contact[], deals: Deal[], activities: Activity[], proposals: Proposal[], auditEvents: AuditEvent[], now: Date) {
  const account = accounts.find(record => record.id === deal.accountId);
  const context = buildAccountDetail(deal.accountId, deals, contacts, activities, proposals, now, { account, auditEvents });
  const history = context.activities.filter(activity => activity.dealId === deal.id);
  const participantIds = new Set(history.flatMap(activity => activity.participants ?? []));
  const people = context.contacts.filter(contact => participantIds.has(contact.id)).map(contact => ({ ...contact, lastRelatedActivityAt: latestTimestamp(history.filter(activity => activity.participants?.includes(contact.id)).map(activity => activity.occurredAt)) }));
  const relatedProposals = context.proposals.filter(proposal => proposal.dealId === deal.id || proposal.changes.some(change => change.entityType === "Deal" && change.entityId === deal.id));
  const proposalIds = new Set(relatedProposals.map(proposal => proposal.id));
  // Include proposal decisions, but never sibling deal/contact field events from a mixed approval.
  const events = context.auditEvents.filter(event => event.entityType === "Deal" && event.entityId === deal.id || event.entityType === "Proposal" && proposalIds.has(event.entityId));
  const lastActivityAt = latestTimestamp([deal.lastActivityAt, ...history.map(activity => activity.occurredAt)]);
  const today = now.toISOString().slice(0, 10);
  const daysUntilClose = deal.expectedCloseDate ? Math.round((Date.parse(deal.expectedCloseDate) - Date.parse(today)) / day) : undefined;
  const open = !isTerminalDealStage(deal.stage);
  const stale = !lastActivityAt || now.getTime() - Date.parse(lastActivityAt) >= 14 * day;
  const pending = relatedProposals.filter(isPendingProposal);
  const signals = [
    deal.risk !== "Low" && `${deal.risk} risk`,
    open && stale && (lastActivityAt ? "Stale activity · no activity in 14 days" : "No activity recorded"),
    open && daysUntilClose !== undefined && daysUntilClose < 0 && "Overdue expected close date",
    open && !deal.nextStep?.trim() && "No next step defined",
    open && deal.probability < 30 && "Low probability · below 30%",
    pending.length > 0 && `${pending.length} pending review${pending.length === 1 ? "" : "s"}`,
  ].filter((signal): signal is string => Boolean(signal));
  const closeTiming = daysUntilClose === undefined ? "Unscheduled" : !open ? "Closed opportunity" : daysUntilClose < 0 ? `${Math.abs(daysUntilClose)} days overdue` : daysUntilClose === 0 ? "Due today" : `${daysUntilClose} days until close`;
  return { deal, account, activities: history, contacts: people, proposals: relatedProposals, pending, auditEvents: events, lastActivityAt, daysUntilClose, closeTiming, signals, proposalChanges: context.proposalChanges, sourceActivities: context.activities };
}
export type DealDetail = ReturnType<typeof buildDealDetail>;

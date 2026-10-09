import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import { isTerminalDealStage } from "../../domain/deals/rules";
import type { Proposal } from "../../domain/proposals/proposal";
import type { AuditEvent } from "../../domain/audit/audit.types";
import { isUnreviewed, isProposalChangeStale } from "../../domain/proposals/review";
import { formatDealValue } from "../pipeline/pipeline-model";

export const accountStatuses = ["Prospect", "Active", "Customer", "Dormant"] as const;
export const missingRegionFilter = "__dealpatch_missing_region__";
export const accountHref = (id: string) => `/accounts/${encodeURIComponent(id)}`;
export const isPendingProposal = (proposal: Proposal) => (proposal.status === "Pending" || proposal.status === "PartiallyApproved") && proposal.changes.some(isUnreviewed);

export function pipelineTotals(deals: Deal[]) {
  const totals = new Map<string, number>();
  for (const deal of deals) totals.set(deal.currency, (totals.get(deal.currency) ?? 0) + deal.value);
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => ({ currency, value }));
}
export const pipelineLabel = (totals: ReturnType<typeof pipelineTotals>) => totals.length ? totals.map(total => formatDealValue(total.value, total.currency)).join(" · ") : "—";
export const latestTimestamp = (values: (string | undefined)[]) => values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a))[0];

export function buildAccountRows(accounts: Account[], deals: Deal[], activities: Activity[], proposals: Proposal[]) {
  const relatedDeals = new Map<string, Deal[]>();
  const dates = new Map<string, string[]>();
  const reviews = new Map<string, number>();
  for (const deal of deals) {
    if (!isTerminalDealStage(deal.stage)) relatedDeals.set(deal.accountId, [...(relatedDeals.get(deal.accountId) ?? []), deal]);
    if (deal.lastActivityAt) dates.set(deal.accountId, [...(dates.get(deal.accountId) ?? []), deal.lastActivityAt]);
  }
  for (const activity of activities) dates.set(activity.accountId, [...(dates.get(activity.accountId) ?? []), activity.occurredAt]);
  for (const proposal of proposals) if (isPendingProposal(proposal)) reviews.set(proposal.accountId, (reviews.get(proposal.accountId) ?? 0) + 1);
  return accounts.map(account => ({ ...account, openDeals: (relatedDeals.get(account.id) ?? []).length, pipeline: pipelineTotals(relatedDeals.get(account.id) ?? []), lastActivityAt: latestTimestamp(dates.get(account.id) ?? []), pendingReviews: reviews.get(account.id) ?? 0 }));
}
export type AccountRow = ReturnType<typeof buildAccountRows>[number];

export function matchesAccountSearch(account: AccountRow, query: string) {
  const text = [account.name, account.status, account.industry, account.region, account.ownerId].join(" ").toLocaleLowerCase("en");
  return query.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean).every(term => text.includes(term));
}

/** Currency groups sort lexically, then amounts numerically; never invent an FX rate. */
export function compareAccountPipeline(a: AccountRow, b: AccountRow) {
  const group = a.pipeline.map(total => total.currency).join(",").localeCompare(b.pipeline.map(total => total.currency).join(","));
  if (group) return group;
  for (let i = 0; i < a.pipeline.length; i++) {
    const difference = a.pipeline[i].value - b.pipeline[i].value;
    if (difference) return difference;
  }
  return 0;
}

export function buildAccountDetail(accountId: string, deals: Deal[], contacts: Contact[], activities: Activity[], proposals: Proposal[], now: Date, options: { account?: Account; auditEvents?: AuditEvent[] } = {}) {
  const opportunities = deals.filter(deal => deal.accountId === accountId);
  const open = opportunities.filter(deal => !isTerminalDealStage(deal.stage));
  const people = contacts.filter(contact => contact.accountId === accountId).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const dealById = new Map(opportunities.map(deal => [deal.id, deal]));
  const contactById = new Map(people.map(contact => [contact.id, contact]));
  const history = activities.filter(activity => activity.accountId === accountId).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)).map(activity => ({
    ...activity, relatedDeal: activity.dealId ? dealById.get(activity.dealId) : undefined,
    participantLabels: (activity.participants ?? []).map(id => {
      const contact = contactById.get(id);
      return { id, available: Boolean(contact), name: contact ? `${contact.firstName} ${contact.lastName}` : "Unavailable contact" };
    }),
  }));
  const changes = proposals.filter(proposal => proposal.accountId === accountId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const records = new Map<string, Account | Deal | Contact | Activity>([
    ...opportunities.map(record => [`Deal:${record.id}`, record] as const),
    ...people.map(record => [`Contact:${record.id}`, record] as const),
    ...history.map(record => [`Activity:${record.id}`, record] as const),
  ]);
  if (options.account?.id === accountId) records.set(`Account:${accountId}`, options.account);
  const proposalChanges = new Map(changes.map(proposal => [proposal.id, proposal.changes.map(change => {
    const record = records.get(`${change.entityType}:${change.entityId}`);
    const current: unknown = record ? Reflect.get(record, change.field) ?? null : null;
    return { change, current, missing: !record, stale: isUnreviewed(change) && (!record || isProposalChangeStale(change, current)) };
  })]));
  const proposalIds = new Set(changes.map(proposal => proposal.id));
  const auditEvents = (options.auditEvents ?? []).filter(event => records.has(`${event.entityType}:${event.entityId}`) || (event.entityType === "Account" && event.entityId === accountId) || (event.entityType === "Proposal" && proposalIds.has(event.entityId)) || (event.proposalId !== null && proposalIds.has(event.proposalId))).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const risks = open.map(deal => {
    const latest = latestTimestamp([deal.lastActivityAt, ...history.filter(activity => activity.dealId === deal.id).map(activity => activity.occurredAt)]);
    const reasons = [deal.risk !== "Low" && `${deal.risk} risk`, deal.expectedCloseDate && deal.expectedCloseDate < now.toISOString().slice(0, 10) && "Overdue close", !deal.nextStep?.trim() && "No next step", (!latest || now.getTime() - Date.parse(latest) >= 14 * 86_400_000) && "Stale activity"].filter((reason): reason is string => Boolean(reason));
    return { deal, reasons };
  }).filter(item => item.reasons.length);
  return { opportunities, open, contacts: people, keyContacts: people.filter(contact => contact.status === "Active").slice(0, 4), activities: history, proposals: changes, proposalChanges, auditEvents, pending: changes.filter(isPendingProposal), pipeline: pipelineTotals(open), lastActivityAt: latestTimestamp([...history.map(activity => activity.occurredAt), ...opportunities.map(deal => deal.lastActivityAt)]), risks };
}
export type AccountDetailData = ReturnType<typeof buildAccountDetail>;

import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { AuditEvent } from "../../domain/audit/audit.types";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { Proposal } from "../../domain/proposals/proposal";
import { buildAccountDetail, isPendingProposal } from "../accounts/accounts-model";
import { isUnreviewed } from "../../domain/proposals/review";
import { involvesContact } from "./contacts-model";

/** Use the account join once, then narrow explicit contact relationships. */
export function buildContactDetail(contact: Contact, accounts: Account[], contacts: Contact[], deals: Deal[], activities: Activity[], proposals: Proposal[], auditEvents: AuditEvent[], now: Date) {
  const account = accounts.find(account => account.id === contact.accountId);
  const data = buildAccountDetail(contact.accountId, deals, contacts, activities, proposals, now, { account, auditEvents });
  const history = data.activities.filter(activity => activity.participants?.includes(contact.id));
  const dealIds = new Set(history.map(activity => activity.dealId));
  const changes = data.proposals.filter(proposal => involvesContact(proposal, contact)).map(proposal => ({ ...proposal, changes: proposal.changes.filter(change => change.entityType === "Contact" && change.entityId === contact.id) }));
  const proposalIds = new Set(changes.map(proposal => proposal.id));
  const contactAudit = data.auditEvents.filter(event => (event.entityType === "Contact" && event.entityId === contact.id) || (event.entityType === "Proposal" && proposalIds.has(event.entityId)));
  const proposalChanges = new Map(changes.map(proposal => [proposal.id, (data.proposalChanges.get(proposal.id) ?? []).filter(item => item.change.entityType === "Contact" && item.change.entityId === contact.id)]));
  const reviewed = changes.map(proposal => ({ ...proposal, changes: proposal.changes.filter(change => !isUnreviewed(change) || !isPendingProposal(proposal)) })).filter(proposal => proposal.changes.length);
  return { account, contact, reviewed, sourceActivities: data.activities, data: { ...data, proposalChanges, activities: history, opportunities: data.opportunities.filter(deal => dealIds.has(deal.id)), proposals: changes, pending: changes.filter(proposal => involvesContact(proposal, contact, true)), auditEvents: contactAudit } };
}

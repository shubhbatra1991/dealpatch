import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { Proposal } from "../../domain/proposals/proposal";
import { isUnreviewed } from "../../domain/proposals/review";
import { buildAccountRows, isPendingProposal, latestTimestamp } from "../accounts/accounts-model";

export const contactHref = (id: string) => `/contacts/${encodeURIComponent(id)}`;
export const contactName = (contact: Contact) => `${contact.firstName} ${contact.lastName}`;
export const missingContactRegion = "__missing_region__";

export function involvesContact(proposal: Proposal, contact: Contact, pendingOnly = false) {
  return proposal.accountId === contact.accountId && (!pendingOnly || isPendingProposal(proposal)) && proposal.changes.some(change => change.entityType === "Contact" && change.entityId === contact.id && (!pendingOnly || isUnreviewed(change)));
}

/** Deals belong to accounts; activities and proposals have explicit contact references. */
export function buildContactRows(contacts: Contact[], accounts: Account[], deals: Deal[], activities: Activity[], proposals: Proposal[]) {
  const accountById = new Map(buildAccountRows(accounts, deals, [], []).map(account => [account.id, account]));
  return contacts.map(contact => {
    const account = accountById.get(contact.accountId);
    const history = activities.filter(activity => activity.accountId === contact.accountId && activity.participants?.includes(contact.id));
    return { ...contact, name: contactName(contact), accountName: account?.name, region: account?.region, accountAvailable: Boolean(account), openDeals: account?.openDeals ?? 0, lastActivityAt: latestTimestamp(history.map(activity => activity.occurredAt)), pendingReviews: proposals.filter(proposal => involvesContact(proposal, contact, true)).length };
  });
}
export type ContactRow = ReturnType<typeof buildContactRows>[number];

export function matchesContactSearch(contact: ContactRow, query: string) {
  const text = [contact.name, contact.role, contact.email, contact.accountName].join(" ").toLocaleLowerCase("en");
  return query.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean).every(term => text.includes(term));
}

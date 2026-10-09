import type { Account } from "../../domain/accounts/account";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { Activity } from "../../domain/activities/activity";
import type { Proposal } from "../../domain/proposals/proposal";
import { accountHref } from "../accounts/accounts-model";
import { contactHref, contactName } from "../contacts/contacts-model";
import { formatDealValue, stageLabels } from "../pipeline/pipeline-model";
import { fieldLabel, displayTimestamp } from "../reviews/review-format";
import { dealHref } from "../deals/deal-detail-model";

export const searchGroups = ["Accounts", "Contacts", "Deals", "Reviews", "Activities"] as const;
export type SearchGroup = typeof searchGroups[number];
export interface SearchEntry { key: string; group: SearchGroup; label: string; context: string; metadata: string; href: string; text: string }
export interface SearchData { accounts: Account[]; contacts: Contact[]; deals: Deal[]; proposals: Proposal[]; activities: Activity[] }
const normalize = (text: string) => text.toLocaleLowerCase("en").normalize("NFKC");
const join = (parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ");
const targetHref = (path: string, parameter: string, id: string) => `${path}?${parameter}=${encodeURIComponent(id)}`;

/** Rebuilt only when cached records change; the index never becomes a second data store. */
export function buildSearchIndex(data: SearchData): SearchEntry[] {
  const accounts = new Map(data.accounts.map(account => [account.id, account]));
  const deals = new Map(data.deals.map(deal => [deal.id, deal]));
  function entry(group: SearchGroup, id: string, label: string, context: string, metadata: string, href: string, fields: (string | undefined)[]): SearchEntry {
    return { key: `${group}:${id}`, group, label, context, metadata, href, text: normalize(fields.join(" ")) };
  }
  return [
    ...data.accounts.map(account => entry("Accounts", account.id, account.name, join([account.industry, account.region]), account.status, accountHref(account.id), [account.name, account.industry, account.region])),
    ...data.contacts.map(contact => { const account = accounts.get(contact.accountId); return entry("Contacts", contact.id, contactName(contact), join([contact.role, account?.name, contact.email]), contact.status, contactHref(contact.id), [contact.firstName, contact.lastName, contact.role, contact.email, account?.name]); }),
    ...data.deals.map(deal => { const account = accounts.get(deal.accountId); return entry("Deals", deal.id, deal.title, join([account?.name, stageLabels[deal.stage], formatDealValue(deal.value, deal.currency)]), deal.risk + " risk", dealHref(deal.id), [deal.title, account?.name, stageLabels[deal.stage], deal.stage, deal.nextStep]); }),
    ...data.proposals.map(proposal => {
      const account = accounts.get(proposal.accountId);
      const candidate = proposal.dealId ? deals.get(proposal.dealId) : undefined;
      const deal = candidate?.accountId === proposal.accountId ? candidate : undefined;
      const fields = [...new Set(proposal.changes.map(change => fieldLabel(change.field)))].join(", ");
      return entry("Reviews", proposal.id, `${account?.name ?? "Unavailable account"} — ${fields || "Review proposal"}`, join([deal?.title, proposal.status === "PartiallyApproved" ? "Partially approved" : proposal.status]), `${proposal.confidence}% confidence`, targetHref("/reviews", "proposal", proposal.id), [account?.name, deal?.title, fields, ...proposal.changes.map(change => change.field), ...proposal.evidence.map(evidence => evidence.text)]);
    }),
    ...data.activities.map(activity => {
      const candidate = activity.dealId ? deals.get(activity.dealId) : undefined;
      const deal = candidate?.accountId === activity.accountId ? candidate : undefined;
      const account = accounts.get(activity.accountId);
      return entry("Activities", activity.id, activity.title, join([account?.name, deal?.title, activity.type]), displayTimestamp(activity.occurredAt), targetHref("/activity", "activity", activity.id), [activity.title, activity.summary, account?.name, deal?.title]);
    }),
  ];
}

/** Every whitespace-separated term must partially match; grouping stays predictable. */
export function searchIndex(index: SearchEntry[], query: string, limitPerGroup = 6) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const matches = index.filter(entry => terms.every(term => entry.text.includes(term)));
  const groups = searchGroups.map(group => {
    const all = matches.filter(entry => entry.group === group);
    return { name: group, total: all.length, entries: all.slice(0, Math.max(0, limitPerGroup)) };
  }).filter(group => group.total > 0);
  return { groups, entries: groups.flatMap(group => group.entries), total: matches.length };
}

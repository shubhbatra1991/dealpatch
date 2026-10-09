import type { Account } from "../../domain/accounts/account";
import type { Activity, ActivityType } from "../../domain/activities/activity";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";

export const activityTypes: ActivityType[] = ["Meeting", "Email", "Call", "Note"];
export interface ActivityRow { activity: Activity; account?: Account; deal?: Deal }
export interface ActivityFilters { search: string; type: ActivityType | ""; accountId: string }

export function buildActivityRows(activities: Activity[], accounts: Account[], deals: Deal[]): ActivityRow[] {
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const dealMap = new Map(deals.map(deal => [deal.id, deal]));
  return activities.map(activity => {
    const deal = activity.dealId ? dealMap.get(activity.dealId) : undefined;
    return { activity, account: accountMap.get(activity.accountId), deal: deal?.accountId === activity.accountId ? deal : undefined };
  }).sort((a, b) => Date.parse(b.activity.occurredAt) - Date.parse(a.activity.occurredAt) || a.activity.id.localeCompare(b.activity.id));
}

export function filterActivityRows(rows: ActivityRow[], filters: ActivityFilters): ActivityRow[] {
  const terms = filters.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return rows.filter(({ activity, account, deal }) => {
    const text = [activity.title, activity.summary, activity.type, account?.name, deal?.title].join(" ").toLowerCase();
    return (!filters.type || activity.type === filters.type) && (!filters.accountId || activity.accountId === filters.accountId) && terms.every(term => text.includes(term));
  });
}

export function adjacentActivityId(rows: ActivityRow[], currentId: string, direction: number): string | undefined {
  if (!rows.length) return undefined;
  const current = rows.findIndex(row => row.activity.id === currentId);
  const index = current < 0 ? direction < 0 ? rows.length - 1 : 0 : Math.max(0, Math.min(rows.length - 1, current + direction));
  return rows[index].activity.id;
}

export function activityParticipants(activity: Activity, contacts: Contact[]) {
  const people = new Map(contacts.filter(contact => contact.accountId === activity.accountId).map(contact => [contact.id, contact]));
  return (activity.participants ?? []).map(id => {
    const person = people.get(id);
    return { id, name: person ? `${person.firstName} ${person.lastName}` : `Unavailable contact (${id})`, available: Boolean(person) };
  });
}

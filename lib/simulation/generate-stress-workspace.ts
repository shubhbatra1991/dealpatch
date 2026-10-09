import type { SeedData } from "../db/seed";
import { generateDemoDeals } from "./generate-demo-deals";

export const stressSizes = { accounts: 500, contacts: 10_000, deals: 5_000, activities: 25_000, proposals: 1_000 } as const;

/** Test/development fixture only. Callers supply validated fictional templates.
 * Never imported by the app, never writes storage, no clock/random dependence.
 */
export function generateStressWorkspace(seed: SeedData, sizes: Record<keyof typeof stressSizes, number> = stressSizes): SeedData {
  for (const count of Object.values(sizes)) if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) throw new RangeError("Stress counts must be integers from 1 to 100,000.");
  if (sizes.contacts < sizes.accounts || sizes.activities < sizes.deals || sizes.proposals > sizes.deals) throw new RangeError("Stress relationships require contacts >= accounts, activities >= deals, proposals <= deals.");
  const accounts = Array.from({ length: sizes.accounts }, (_, i) => ({ ...seed.accounts[i % seed.accounts.length], id: `stress-account-${i + 1}`, name: `${seed.accounts[i % seed.accounts.length].name} ${i + 1}` }));
  const contacts = Array.from({ length: sizes.contacts }, (_, i) => ({ ...seed.contacts[i % seed.contacts.length], id: `stress-contact-${i + 1}`, accountId: accounts[i % accounts.length].id, lastName: `${seed.contacts[i % seed.contacts.length].lastName} ${i + 1}`, email: `contact${i + 1}@dealpatch-stress.example` }));
  const deals = generateDemoDeals(accounts, sizes.deals);
  const evidence = "The commercial sponsor asked for a revised rollout plan and a seat estimate before arranging the next internal review.";
  const activities = Array.from({ length: sizes.activities }, (_, i) => {
    const dealIndex = i % deals.length;
    const accountIndex = dealIndex % accounts.length;
    const deal = deals[dealIndex];
    const occurredAt = new Date(Date.UTC(2026, 8, 1) + i * 60_000).toISOString();
    deal.lastActivityAt = occurredAt;
    return { ...seed.activities[i % seed.activities.length], id: `stress-activity-${i + 1}`, accountId: deal.accountId, dealId: deal.id, title: `Commercial follow-up ${i + 1}`, summary: evidence, occurredAt, participants: [contacts[accountIndex].id], type: (["Meeting", "Email", "Call", "Note"] as const)[i % 4] };
  });
  const proposals = Array.from({ length: sizes.proposals }, (_, i) => {
    const deal = deals[i];
    const activity = activities[i];
    return { ...seed.proposals[0], id: `stress-proposal-${i + 1}`, accountId: deal.accountId, dealId: deal.id, sourceActivityId: activity.id, createdAt: activity.occurredAt, confidence: 70 + i % 26,
      changes: [{ id: `stress-change-${i + 1}`, entityType: "Deal" as const, entityId: deal.id, field: "nextStep" as const, before: deal.nextStep ?? null, after: "Send the revised rollout plan and seat estimate to the commercial sponsor.", selected: true, status: "Pending" as const }],
      evidence: [{ type: "activity_excerpt" as const, sourceActivityId: activity.id, text: evidence }],
    };
  });
  return { accounts, contacts, deals, activities, proposals };
}

import type { Account } from "../../domain/accounts/account";
import type { Deal, DealStage } from "../../domain/deals/deal";

const stages: DealStage[] = ["Discovery", "Evaluation", "Proposal", "Negotiation", "ClosedWon", "ClosedLost"];
const programmes = ["Commercial workflow rollout", "Regional team expansion", "Partner operations pilot", "Renewal and seat expansion", "Territory planning programme", "Revenue reporting consolidation"];
const nextSteps = ["Confirm the buying committee and discovery agenda.", "Complete the integration assessment with IT.", "Review the commercial proposal with procurement.", "Resolve contract redlines and confirm signature date.", "Schedule the implementation handover.", "Record decision feedback for the next budget cycle."];

/** Deterministic, in-memory fixtures only. Does not import seeds or write storage. */
export function generateDemoDeals(accounts: readonly Account[], count = 10_000): Deal[] {
  if (!Number.isInteger(count) || count < 0 || count > 100_000) {
    throw new RangeError("Deal count must be an integer between 0 and 100,000.");
  }
  if (count > 0 && accounts.length === 0) throw new Error("At least one fictional account is required.");

  return Array.from({ length: count }, (_, index) => {
    const account = accounts[index % accounts.length];
    const stageIndex = Math.floor(index / accounts.length) % stages.length;
    const programme = programmes[(index * 7 + Math.floor(index / accounts.length)) % programmes.length];
    return {
      id: `performance-deal-${index + 1}`,
      accountId: account.id,
      title: `${account.name} — ${programme} ${Math.floor(index / accounts.length) + 1}`,
      stage: stages[stageIndex],
      value: 12_000 + (index * 7919) % 420_000,
      currency: ["EUR", "GBP", "USD"][index % 3],
      probability: [20, 45, 65, 85, 100, 0][stageIndex],
      expectedCloseDate: stageIndex >= 4 ? "2026-09-30" : `2026-${index % 2 ? "11" : "10"}-${String(10 + index % 18).padStart(2, "0")}`,
      ownerId: account.ownerId,
      risk: (["Low", "Medium", "High"] as const)[Math.floor(index / 3) % 3],
      nextStep: nextSteps[stageIndex],
      lastActivityAt: `2026-09-${String(10 + index % 20).padStart(2, "0")}T10:00:00.000Z`,
    };
  });
}

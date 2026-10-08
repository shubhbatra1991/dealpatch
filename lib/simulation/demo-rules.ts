import type { Activity } from "../../domain/activities/activity";
import type { Deal } from "../../domain/deals/deal";
import type { ProposalChange } from "../../domain/proposals/proposal-change";

const phrases = {
  evaluation: "discovery is complete and IT will begin the technical assessment",
  closeDate: "expects a decision by 4 December",
  rollout: "asked for a revised rollout plan and a seat estimate",
  budget: "Budget approval remains unresolved",
} as const;
export type DemoSignal = keyof typeof phrases;

export function findDemoSignals(summary: string): DemoSignal[] {
  return (Object.keys(phrases) as DemoSignal[]).filter(key => summary.toLowerCase().includes(phrases[key].toLowerCase()));
}
export function evidenceForSignals(summary: string, signals: DemoSignal[]): string[] {
  const sentences = summary.match(/[^.!?]+[.!?]?/g) ?? [summary];
  return sentences.map(sentence => sentence.trim()).filter(sentence => signals.some(key => sentence.toLowerCase().includes(phrases[key].toLowerCase())));
}

/** Deliberately narrow demo rules, not general natural-language understanding. */
export function detectDemoChanges(activity: Activity, deal: Deal, signals: DemoSignal[]): ProposalChange[] {
  if (deal.stage === "ClosedWon" || deal.stage === "ClosedLost") return [];
  const changes: ProposalChange[] = [];
  const base = { entityType: "Deal", entityId: deal.id, selected: true, status: "Pending" } as const;
  if (signals.includes("evaluation") && deal.stage === "Discovery") {
    changes.push({ ...base, id: `${activity.id}:stage`, field: "stage", before: deal.stage, after: "Evaluation" });
    if (deal.probability < 45) changes.push({ ...base, id: `${activity.id}:probability`, field: "probability", before: deal.probability, after: 45 });
  }
  if (signals.includes("closeDate")) {
    const date = `${activity.occurredAt.slice(0, 4)}-12-04`;
    if (deal.expectedCloseDate !== date) changes.push({ ...base, id: `${activity.id}:close`, field: "expectedCloseDate", before: deal.expectedCloseDate ?? null, after: date });
  }
  if (signals.includes("rollout")) {
    const next = "Send the revised rollout plan and seat estimate to the commercial sponsor.";
    if (deal.nextStep !== next) changes.push({ ...base, id: `${activity.id}:next`, field: "nextStep", before: deal.nextStep ?? null, after: next });
  }
  if (signals.includes("budget")) {
    if (deal.risk !== "High") changes.push({ ...base, id: `${activity.id}:risk`, field: "risk", before: deal.risk, after: "High" });
    if (deal.probability > 70) changes.push({ ...base, id: `${activity.id}:probability`, field: "probability", before: deal.probability, after: 70 });
  }
  return changes;
}

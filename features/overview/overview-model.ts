import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Deal } from "../../domain/deals/deal";
import { isTerminalDealStage } from "../../domain/deals/rules";
import type { Proposal } from "../../domain/proposals/proposal";
import { isUnreviewed } from "../../domain/proposals/review";

export const openStages = ["Discovery", "Evaluation", "Proposal", "Negotiation"] as const;
export const staleDays = 14;
export const highConfidence = 90;
const day = 86_400_000;

/** Unpersisted projection; an explicit clock keeps dates deterministic in tests. */
export function buildOverview(deals: Deal[], accounts: Account[], activities: Activity[], proposals: Proposal[], now: Date) {
  const today = now.toISOString().slice(0, 10);
  const open = deals.filter(deal => !isTerminalDealStage(deal.stage));
  const names = new Map(accounts.map(account => [account.id, account.name]));
  const latest = new Map<string, number>();
  for (const activity of activities) {
    const time = Date.parse(activity.occurredAt);
    if (activity.dealId && time <= now.getTime()) latest.set(activity.dealId, Math.max(time, latest.get(activity.dealId) ?? 0));
  }
  const attention = open.map(deal => {
    const recorded = deal.lastActivityAt ? Date.parse(deal.lastActivityAt) : 0;
    const lastActivity = Math.max(recorded <= now.getTime() ? recorded : 0, latest.get(deal.id) ?? 0);
    const overdue = Boolean(deal.expectedCloseDate && deal.expectedCloseDate < today);
    const missingNextStep = !deal.nextStep?.trim();
    const stale = !lastActivity || now.getTime() - lastActivity >= staleDays * day;
    const highRisk = deal.risk === "High";
    const reasons = [overdue && "Overdue close", highRisk && "High risk", missingNextStep && "No next step", stale && "Stale activity"].filter((reason): reason is string => Boolean(reason));
    return { deal, accountName: names.get(deal.accountId) ?? "Unknown account", overdue, missingNextStep, stale, highRisk, reasons };
  });
  const counts = {
    overdue: attention.filter(item => item.overdue).length,
    missingNextStep: attention.filter(item => item.missingNextStep).length,
    stale: attention.filter(item => item.stale).length,
    highRisk: attention.filter(item => item.highRisk).length,
  };
  const pending = proposals.filter(proposal => (proposal.status === "Pending" || proposal.status === "PartiallyApproved") && proposal.changes.some(isUnreviewed));
  const reviews = {
    pending: pending.length,
    dealUpdates: pending.filter(proposal => proposal.changes.some(change => isUnreviewed(change) && change.entityType === "Deal")).length,
    contactUpdates: pending.filter(proposal => proposal.changes.some(change => isUnreviewed(change) && change.entityType === "Contact")).length,
    highConfidence: pending.filter(proposal => proposal.confidence >= highConfidence).length,
  };
  const denominator = Math.max(open.length, 1);
  const healthFactors = [
    { label: "Stale deals", count: counts.stale, deduction: 25 * counts.stale / denominator },
    { label: "Overdue close dates", count: counts.overdue, deduction: 25 * counts.overdue / denominator },
    { label: "Missing next steps", count: counts.missingNextStep, deduction: 25 * counts.missingNextStep / denominator },
    { label: "Pending reviews", count: reviews.pending, deduction: 25 * Math.min(reviews.pending / denominator, 1) },
  ];
  const health = Math.max(0, Math.min(100, Math.round(100 - healthFactors.reduce((sum, factor) => sum + factor.deduction, 0))));
  const currencyTotals = new Map<string, number>();
  for (const deal of open) currencyTotals.set(deal.currency, (currencyTotals.get(deal.currency) ?? 0) + deal.value);
  const suggestions: { id: string; text: string; detail: string; href: string }[] = [];
  if (reviews.highConfidence) suggestions.push({ id: "reviews", text: `Review ${reviews.highConfidence} high-confidence ${reviews.highConfidence === 1 ? "proposal" : "proposals"}`, detail: "90%+ confidence · verify evidence before approval", href: "/workspace/reviews" });
  else if (reviews.pending) suggestions.push({ id: "reviews", text: `Work through ${reviews.pending} pending reviews`, detail: "Inspect proposed changes and supporting evidence", href: "/workspace/reviews" });
  if (counts.missingNextStep) suggestions.push({ id: "next-step", text: `Define next steps for ${counts.missingNextStep} deals`, detail: "Agree a concrete follow-up with the buying team", href: "/workspace/pipeline" });
  if (counts.overdue) suggestions.push({ id: "overdue", text: `Revisit ${counts.overdue} overdue close dates`, detail: "Confirm the decision timeline with each sponsor", href: "/workspace/pipeline" });
  if (counts.highRisk) suggestions.push({ id: "risk", text: `Check ${counts.highRisk} high-risk deals`, detail: "Identify blockers and agree a recovery plan", href: "/workspace/pipeline" });
  if (counts.stale) suggestions.push({ id: "stale", text: `Reconnect on ${counts.stale} stale deals`, detail: "No recorded deal activity in at least 14 days", href: "/workspace/activity" });
  const fallbacks = [
    { id: "pipeline", text: open.length ? `Check priorities across ${open.length} open deals` : "Explore the pipeline", detail: open.length ? "Confirm owners, stages and the next commercial milestone" : "No open deals currently need follow-up", href: "/workspace/pipeline" },
    { id: "accounts", text: `Review ${accounts.length} account records`, detail: "Check company context before your next conversation", href: "/workspace/accounts" },
    { id: "activity", text: activities.length ? "Catch up on the latest interactions" : "Open the activity workspace", detail: `${activities.length} recorded interactions in this local workspace`, href: "/workspace/activity" },
  ];
  for (const suggestion of fallbacks) if (suggestions.length < 3) suggestions.push(suggestion);
  return {
    openDeals: open.length, accountCount: new Set(open.map(deal => deal.accountId)).size,
    atRisk: open.filter(deal => deal.risk !== "Low").length,
    currencies: [...currencyTotals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => ({ currency, value })),
    stages: openStages.map(stage => ({ stage, count: open.filter(deal => deal.stage === stage).length })),
    counts, reviews, health, healthFactors,
    attention: attention.filter(item => item.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length || Number(b.overdue) - Number(a.overdue) || a.deal.id.localeCompare(b.deal.id)),
    suggestions: suggestions.slice(0, 5),
    recent: [...activities].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id)).slice(0, 5).map(activity => ({ ...activity, accountName: names.get(activity.accountId) ?? "Unknown account" })),
    today,
  };
}

export type OverviewData = ReturnType<typeof buildOverview>;
export function formatOverviewMoney(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 2 }).format(value)}`;
}

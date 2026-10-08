import type { Account } from "../../domain/accounts/account";
import type { Deal, DealRisk, DealStage } from "../../domain/deals/deal";

export type PipelineRow = Deal & { accountName: string };

export const stageLabels: Record<DealStage, string> = {
  Discovery: "Discovery", Evaluation: "Evaluation", Proposal: "Proposal",
  Negotiation: "Negotiation", ClosedWon: "Closed Won", ClosedLost: "Closed Lost",
};
export const stageOrder = Object.keys(stageLabels) as DealStage[];
export const riskOrder: DealRisk[] = ["Low", "Medium", "High"];

export function buildPipelineRows(deals: Deal[], accounts: Account[]): PipelineRow[] {
  const names = new Map(accounts.map((account) => [account.id, account.name]));
  return deals.map((deal) => ({ ...deal, accountName: names.get(deal.accountId) ?? "Unknown account" }));
}

/** Search remains independent of column visibility and includes readable stages. */
export function matchesPipelineSearch(row: PipelineRow, query: string): boolean {
  const terms = query.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
  const text = [row.accountName, row.title, stageLabels[row.stage], row.ownerId, row.risk, row.nextStep ?? ""]
    .join(" ").toLocaleLowerCase("en");
  return terms.every((term) => text.includes(term));
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function formatPipelineDate(value?: string): string {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

const currencyFormatters = new Map<string, Intl.NumberFormat>();
export function formatDealValue(value: number, currency: string): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 2 });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(value);
}


import Link from "next/link";
import { FavoriteButton } from "../favorites/favorite-button";
import { formatDealValue, formatPipelineDate, stageLabels } from "../pipeline/pipeline-model";
import type { DealDetail } from "./deal-detail-model";

export function DealHeader({ detail }: { detail: DealDetail }) {
  const { deal, account } = detail;
  const summary = [["Value", formatDealValue(deal.value, deal.currency)], ["Probability", `${deal.probability}%`], ["Expected close", formatPipelineDate(deal.expectedCloseDate)], ["Close timing", detail.closeTiming], ["Last activity", formatPipelineDate(detail.lastActivityAt)], ["Pending reviews", detail.pending.length]] as const;
  return <>
    <header className="space-y-2 border-b border-zinc-200 pb-3">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h1 id="deal-title" className="break-words text-lg font-semibold tracking-tight text-zinc-950">{deal.title}</h1><p className="mt-1 text-xs text-zinc-600">{account ? <Link href={`/accounts/${encodeURIComponent(account.id)}`} className="rounded-sm hover:text-indigo-700 hover:underline">{account.name}</Link> : "Unavailable account"}</p></div><FavoriteButton entityType="deal" entityId={deal.id} /></div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-sm border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-medium">{stageLabels[deal.stage]}</span><span className={deal.risk === "High" ? "font-medium text-red-800" : deal.risk === "Medium" ? "text-amber-800" : "text-zinc-600"}><span aria-hidden="true">{deal.risk === "High" ? "▲ " : deal.risk === "Medium" ? "◒ " : "○ "}</span>{deal.risk} risk</span><span className="ml-auto text-zinc-500">Owner: <span className="text-zinc-700">{deal.ownerId}</span></span></div>
    </header>
    <dl aria-label="Deal summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-zinc-200 bg-zinc-200 md:grid-cols-3 xl:grid-cols-6">{summary.map(([label, value]) => <div key={label} className="flex min-w-0 flex-col bg-zinc-50 px-3 py-3"><dt className="order-2 mt-1 text-[11px] text-zinc-500">{label}</dt><dd className="order-1 break-words text-sm font-semibold text-zinc-900 tabular-nums">{value}</dd></div>)}</dl>
  </>;
}


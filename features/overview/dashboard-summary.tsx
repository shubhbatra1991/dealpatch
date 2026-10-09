import Link from "next/link";
import { DashboardCard } from "./dashboard-card";
import { formatOverviewMoney, type OverviewData } from "./overview-model";

export function WorkspaceSummary({ data }: { data: OverviewData }) {
  const metrics = [
    { label: "Open deals", value: data.openDeals, detail: `${data.accountCount} accounts in play`, href: "/pipeline", accent: "bg-accent" },
    { label: "At-risk deals", value: data.atRisk, detail: `${data.counts.highRisk} high · ${data.atRisk - data.counts.highRisk} medium risk`, href: "/pipeline", accent: "bg-warning" },
    { label: "Pending reviews", value: data.reviews.pending, detail: "Human approval required", href: "/reviews", accent: "bg-accent" },
  ];
  return <section aria-label="Workspace summary" className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 xl:grid-cols-4">
    <div className="workspace-metric min-w-0 rounded-sm border border-border bg-surface px-3 py-3">
      <p className="flex items-center gap-2 text-xs text-text-muted"><span aria-hidden="true" className="size-1.5 bg-accent" /><Link href="/pipeline" className="rounded-sm hover:underline">Pipeline value</Link></p>
      <div className="mt-2 space-y-0.5">{data.currencies.length ? data.currencies.map(total => <p key={total.currency} className="break-words text-lg font-semibold tracking-tight text-text tabular-nums">{formatOverviewMoney(total.value, total.currency)}</p>) : <p className="text-lg font-semibold text-text">—</p>}</div>
      <p className="mt-1 text-[11px] text-text-muted">Open deals · no currency conversion</p>
    </div>
    {metrics.map(metric => <div key={metric.label} className="workspace-metric min-w-0 rounded-sm border border-border bg-surface px-3 py-3">
      <p className="flex items-center gap-2 text-xs text-text-muted"><span aria-hidden="true" className={`size-1.5 ${metric.accent}`} /><Link href={metric.href} className="rounded-sm hover:underline">{metric.label}</Link></p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-text tabular-nums">{metric.value}</p>
      <p className="mt-1 text-[11px] leading-4 text-text-muted">{metric.detail}</p>
    </div>)}
  </section>;
}

export function WorkspaceHealth({ data }: { data: OverviewData }) {
  const label = !data.openDeals && !data.reviews.pending ? "No outstanding work" : data.health >= 80 ? "Healthy" : data.health >= 60 ? "Needs focus" : "Needs attention";
  return <DashboardCard id="health-title" title="Workspace Health" eyebrow="Operating signal">
    <div className="px-3 py-3">
      <div className="flex items-end justify-between gap-3"><p className="text-3xl font-semibold tracking-tight text-text tabular-nums">{data.health}<span className="ml-1 text-xs font-normal text-text-muted">/ 100</span></p><p className="pb-1 text-xs font-medium text-text">{label}</p></div>
      <meter aria-label="Workspace health score" min={0} max={100} value={data.health} className="mt-2 h-2 w-full accent-focus-ring">{data.health} out of 100</meter>
      <dl className="mt-3 space-y-2">{data.healthFactors.map(factor => <div key={factor.label} className="flex items-center justify-between gap-2 text-[11px]"><dt className="text-text-muted">{factor.label}</dt><dd className="flex gap-3 tabular-nums"><span className="font-medium text-text">{factor.count}</span><span className="w-12 text-right text-text-muted">−{factor.deduction.toFixed(1)} pts</span></dd></div>)}</dl>
      <details className="mt-3 border-t border-border pt-2 text-[10px] leading-4 text-text-muted"><summary className="w-fit cursor-pointer rounded-sm font-medium text-text-muted">How this is calculated</summary><p className="mt-1">Starts at 100. Each factor deducts up to 25 points: affected count ÷ open deals × 25 (capped at 25). Reviews use pending proposal count. Stale means 14+ days without deal activity, or none recorded. Close dates use today in UTC. With no open deals, the denominator is 1. Factors can overlap; the final score is rounded.</p></details>
    </div>
  </DashboardCard>;
}

export function PipelineStageSummary({ data }: { data: OverviewData }) {
  return <DashboardCard id="stages-title" title="Pipeline Stage Summary" eyebrow="Active opportunities" href="/pipeline" linkLabel="Pipeline">
    <dl className="grid grid-cols-2 gap-px bg-surface-muted">{data.stages.map((item, index) => <div key={item.stage} className="bg-surface px-3 py-3"><dt className="flex items-center gap-1.5 text-[11px] text-text-muted"><span aria-hidden="true" className="text-[10px] text-text-muted">0{index + 1}</span>{item.stage}</dt><dd className="mt-1 text-xl font-semibold text-text tabular-nums">{item.count}</dd></div>)}</dl>
    <p className="px-3 py-2 text-[10px] text-text-muted">{data.openDeals} open deals · closed stages excluded</p>
  </DashboardCard>;
}

export function ReviewQueueSummary({ data }: { data: OverviewData }) {
  const rows = [["Pending proposals", data.reviews.pending], ["Deal updates", data.reviews.dealUpdates], ["Contact updates", data.reviews.contactUpdates], ["High confidence · 90%+", data.reviews.highConfidence]] as const;
  return <DashboardCard id="reviews-title" title="Review Queue Summary" eyebrow="Human-reviewed automation" href="/reviews" linkLabel="Open queue">
    <dl className="divide-y divide-border px-3">{rows.map(([label, count]) => <div key={label} className="flex items-center justify-between py-2.5"><dt className="text-xs text-text-muted">{label}</dt><dd className="text-sm font-semibold text-text tabular-nums">{count}</dd></div>)}</dl>
    <p className="border-t border-border px-3 py-2 text-[10px] leading-4 text-text-muted">Counts are proposals with unreviewed changes. Types may overlap. Confidence never approves changes.</p>
  </DashboardCard>;
}

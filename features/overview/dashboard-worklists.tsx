import Link from "next/link";
import { DashboardCard } from "./dashboard-card";
import type { OverviewData } from "./overview-model";

export function NeedsAttention({ data }: { data: OverviewData }) {
  const counts = [["Overdue", data.counts.overdue], ["High risk", data.counts.highRisk], ["No next step", data.counts.missingNextStep], ["Stale activity", data.counts.stale]] as const;
  return <DashboardCard id="attention-title" title="Needs Attention" href="/workspace/pipeline" linkLabel="Open pipeline">
    <dl className="grid grid-cols-2 gap-px border-b border-border bg-surface-muted sm:grid-cols-4">{counts.map(([label, count]) => <div key={label} className="bg-bg-subtle px-3 py-2"><dt className="text-[10px] text-text-muted">{label}</dt><dd className="mt-0.5 text-sm font-semibold text-text tabular-nums">{count}</dd></div>)}</dl>
    {data.attention.length ? <ul className="divide-y divide-border">{data.attention.slice(0, 5).map(({ deal, accountName, reasons }) => <li key={deal.id} className="px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="text-xs font-semibold text-text">{accountName}</h3>{deal.expectedCloseDate && <span className="text-[10px] text-text-muted">Close <time dateTime={deal.expectedCloseDate}>{deal.expectedCloseDate}</time></span>}</div>
      <p className="mt-0.5 text-[11px] text-text-muted">{deal.title}</p><p className="mt-1 text-[10px] font-medium text-warning"><span aria-hidden="true">! </span>{reasons.join(" · ")}</p>
    </li>)}</ul> : <p className="px-3 py-5 text-xs text-text-muted">No open deals need attention against these checks.</p>}
    {data.attention.length > 5 && <p className="border-t border-border px-3 py-2 text-[10px] text-text-muted">Showing 5 of {data.attention.length} flagged deals · most issues first</p>}
  </DashboardCard>;
}

export function SuggestedActions({ data }: { data: OverviewData }) {
  return <DashboardCard id="actions-title" title="Suggested Actions" eyebrow="Next best steps">
    <ol className="divide-y divide-border">{data.suggestions.map((suggestion, index) => <li key={suggestion.id}><Link href={suggestion.href} className="group flex items-start gap-2.5 px-3 py-3 hover:bg-bg-subtle focus-visible:outline-offset-[-3px]">
      <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] text-text-muted">{index + 1}</span>
      <div className="min-w-0 flex-1"><h3 className="text-xs font-medium text-text group-hover:text-accent">{suggestion.text}</h3><p className="mt-1 text-[10px] leading-4 text-text-muted">{suggestion.detail}</p></div><span aria-hidden="true" className="text-text-subtle">↗</span>
    </Link></li>)}</ol>
  </DashboardCard>;
}

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function RecentActivity({ data }: { data: OverviewData }) {
  return <DashboardCard id="recent-title" title="Recent Activity" href="/workspace/activity" linkLabel="All activity">
    {data.recent.length ? <ul className="divide-y divide-border">{data.recent.map(item => <li key={item.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 px-3 py-2.5 sm:grid-cols-[1.75rem_minmax(7rem,0.6fr)_minmax(0,1fr)_auto]">
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-sm border border-border bg-bg-subtle text-[10px] font-medium text-text-muted">{item.type[0]}</span>
      <div className="min-w-0"><p className="text-xs font-medium text-text">{item.accountName}</p><p className="mt-0.5 text-[10px] text-text-muted">{item.type}</p></div>
      <div className="col-start-2 min-w-0 sm:col-start-auto"><h3 className="text-xs text-text">{item.title}</h3><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-text-muted">{item.summary}</p></div>
      <time dateTime={item.occurredAt} className="col-start-2 text-[10px] text-text-muted tabular-nums sm:col-start-auto">{dateTime.format(new Date(item.occurredAt))} UTC</time>
    </li>)}</ul> : <p className="px-3 py-5 text-xs text-text-muted">No activity recorded in this workspace yet.</p>}
  </DashboardCard>;
}

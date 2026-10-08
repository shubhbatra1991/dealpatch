import Link from "next/link";

// Deliberately static presentation fixtures; these are not local workspace totals.
const metrics = [
  { label: "Pipeline value", value: "$2.84m", detail: "Unweighted · USD equivalent", href: "/pipeline" },
  { label: "Open deals", value: "42", detail: "Across 24 fictional accounts", href: "/pipeline" },
  { label: "At-risk deals", value: "7", detail: "3 high risk · 4 medium risk", href: "/pipeline" },
  { label: "Pending reviews", value: "12", detail: "8 deals · 4 contact updates", href: "/reviews" },
] as const;

const attention = [
  { account: "Avelmere Systems", deal: "Commercial workflow rollout", issue: "Close date has passed", context: "Confirm the sponsor’s revised timeline.", stage: "Negotiation", value: "$184,000", priority: "High" },
  { account: "Corvellan Logistics", deal: "Regional team expansion", issue: "No next step scheduled", context: "Agree a follow-up after the evaluation.", stage: "Evaluation", value: "$96,000", priority: "Medium" },
  { account: "Ternwick Materials", deal: "Revenue operations rollout", issue: "Budget approval outstanding", context: "Procurement needs an updated business case.", stage: "Proposal", value: "$142,000", priority: "High" },
  { account: "Ordelis Health", deal: "Commercial workflow rollout", issue: "No activity in 14 days", context: "Check progress with the buying committee.", stage: "Discovery", value: "$68,000", priority: "Medium" },
] as const;

const reviews = [
  { account: "Avelmere Systems", field: "Stage", before: "Discovery", after: "Evaluation", evidence: "Sponsor confirmed discovery is complete.", source: "Call", confidence: "92%" },
  { account: "Corvellan Logistics", field: "Expected close", before: "23 Oct", after: "6 Nov", evidence: "Budget committee moved its decision date.", source: "Email", confidence: "86%" },
  { account: "Ternwick Materials", field: "Contact role", before: "Procurement Manager", after: "Head of Revenue Systems", evidence: "Contact confirmed a change in responsibilities.", source: "Meeting", confidence: "94%" },
] as const;

const recent = [
  { type: "Meeting", account: "Corvellan Logistics", title: "Technical evaluation completed", detail: "Integration requirements reviewed with the operations team.", time: "10:25", iso: "2026-10-08T10:25:00Z" },
  { type: "Email", account: "Ternwick Materials", title: "Revised commercial terms received", detail: "Procurement shared feedback on the rollout proposal.", time: "09:40", iso: "2026-10-08T09:40:00Z" },
  { type: "Call", account: "Avelmere Systems", title: "Sponsor confirmed next steps", detail: "Technical assessment to begin after the discovery handover.", time: "09:10", iso: "2026-10-08T09:10:00Z" },
  { type: "Note", account: "Ordelis Health", title: "Buying committee updated", detail: "Finance lead added to the next discovery session.", time: "08:45", iso: "2026-10-08T08:45:00Z" },
] as const;

const sectionLink = "shrink-0 rounded-sm text-xs font-medium text-zinc-600 underline-offset-4 hover:text-indigo-700 hover:underline";

export function OverviewWorkspace() {
  return <section aria-labelledby="overview-title" className="mx-auto max-w-[1440px] space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Sales workspace</p><h1 id="overview-title" className="text-xl font-semibold tracking-tight text-zinc-950">Overview</h1><p className="mt-1 text-xs leading-5 text-zinc-600">Review pipeline health, follow up on open work, and check proposed changes.</p></div>
      <div className="text-xs leading-5 text-zinc-500"><p className="font-medium text-zinc-700">Illustrative snapshot</p><p><time dateTime="2026-10-08">8 Oct 2026</time> · Fictional placeholders</p></div>
    </header>

    <dl aria-label="Illustrative sales summary" className="grid grid-cols-2 border-y border-zinc-200 bg-zinc-50/40 lg:grid-cols-4">
      {metrics.map((metric, index) => <div key={metric.label} className={`min-w-0 px-3 py-3 sm:px-4 ${index % 2 ? "border-l border-zinc-200" : ""} ${index > 1 ? "border-t border-zinc-200 lg:border-t-0 lg:border-l" : ""}`}>
        <dt className="text-xs font-medium text-zinc-600"><Link href={metric.href} className="rounded-sm underline-offset-4 hover:underline">{metric.label}<span aria-hidden="true" className="ml-1 text-zinc-400">↗</span></Link></dt>
        <dd className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 tabular-nums">{metric.value}</dd>
        <dd className="mt-1 text-[11px] leading-4 text-zinc-500">{metric.detail}</dd>
      </div>)}
    </dl>

    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section aria-labelledby="attention-title" className="min-w-0">
        <header className="mb-2 flex items-baseline justify-between gap-3"><div className="flex items-baseline gap-2"><h2 id="attention-title" className="text-sm font-semibold text-zinc-900">Needs attention</h2><span className="hidden text-xs text-zinc-500 sm:inline">4 examples</span></div><Link href="/pipeline" className={sectionLink}>Open pipeline <span aria-hidden="true">→</span></Link></header>
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200">{attention.map(item => <li key={item.account} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="text-xs font-semibold text-zinc-800">{item.account}</h3><span className="text-[11px] text-zinc-500">{item.stage}</span></div><p className="mt-0.5 text-[11px] text-zinc-500">{item.deal}</p><p className="mt-2 text-xs font-medium text-zinc-700">{item.issue}</p><p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{item.context}</p></div>
          <div className="shrink-0 text-right"><p className="text-xs font-medium text-zinc-800 tabular-nums">{item.value}</p><p className={`mt-2 text-[11px] ${item.priority === "High" ? "text-amber-800" : "text-zinc-600"}`}><span aria-hidden="true">{item.priority === "High" ? "! " : "◒ "}</span>{item.priority} risk</p></div>
        </li>)}</ul>
      </section>

      <section aria-labelledby="review-preview-title" className="min-w-0">
        <header className="mb-2 flex items-baseline justify-between gap-3"><div className="flex items-baseline gap-2"><h2 id="review-preview-title" className="text-sm font-semibold text-zinc-900">Review queue</h2><span className="hidden text-xs text-zinc-500 sm:inline">3 examples</span></div><Link href="/reviews" className={sectionLink}>Open queue <span aria-hidden="true">→</span></Link></header>
        <p className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600">Simulated suggestions · Human approval required</p>
        <ul className="divide-y divide-zinc-200 border-b border-zinc-200">{reviews.map(item => <li key={item.account} className="py-3">
          <div className="flex items-baseline justify-between gap-2"><h3 className="text-xs font-semibold text-zinc-800">{item.account}</h3><span className="shrink-0 text-[11px] text-zinc-500">{item.confidence} confidence</span></div>
          <p className="mt-1 text-[11px] text-zinc-500">{item.field}</p><p className="mt-1.5 border-l-2 border-indigo-300 pl-2 text-xs leading-5"><span className="text-zinc-500"><span className="sr-only">Current: </span>{item.before}</span><span aria-hidden="true" className="mx-1.5 text-zinc-400">→</span><span className="sr-only"> Proposed: </span><span className="font-medium text-zinc-800">{item.after}</span></p>
          <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">{item.source} · {item.evidence}</p>
        </li>)}</ul>
      </section>
    </div>

    <section aria-labelledby="recent-title">
      <header className="mb-2 flex items-baseline justify-between gap-3"><div className="flex items-baseline gap-2"><h2 id="recent-title" className="text-sm font-semibold text-zinc-900">Recent activity</h2><span className="hidden text-xs text-zinc-500 sm:inline">Snapshot · UTC</span></div><Link href="/activity" className={sectionLink}>Open activity <span aria-hidden="true">→</span></Link></header>
      <ul className="divide-y divide-zinc-100 border-y border-zinc-200">{recent.map(item => <li key={item.iso} className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-x-2 py-2.5 sm:grid-cols-[1.75rem_10rem_minmax(0,1fr)_auto] sm:items-center">
        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-sm border border-zinc-200 bg-zinc-50 text-[10px] font-medium text-zinc-500">{item.type[0]}</span>
        <div className="min-w-0"><h3 className="text-xs font-medium text-zinc-800">{item.account}</h3><p className="mt-0.5 text-[10px] text-zinc-500">{item.type}</p></div>
        <div className="col-start-2 row-start-2 min-w-0 pt-1 sm:col-start-3 sm:row-start-1 sm:pt-0"><p className="text-xs text-zinc-700">{item.title}</p><p className="mt-0.5 text-[11px] leading-4 text-zinc-500">{item.detail}</p></div>
        <time dateTime={item.iso} className="col-start-3 row-start-1 text-[11px] text-zinc-500 tabular-nums sm:col-start-4">{item.time}</time>
      </li>)}</ul>
    </section>
    <p className="text-[11px] leading-4 text-zinc-500">Overview uses fictional placeholder values. This snapshot is not connected to your local workspace data.</p>
  </section>;
}

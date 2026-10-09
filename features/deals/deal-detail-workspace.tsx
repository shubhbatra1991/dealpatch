"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildDealDetail, dealTabs, type DealDetail, type DealTab } from "./deal-detail-model";
import { useDealDetailData } from "./use-deal-detail";
import { DealHeader } from "./deal-header";
import { DealTabContent } from "./deal-sections";

export function DealDetailView({ detail }: { detail: DealDetail }) {
  const [tab, setTab] = useState<DealTab>("Overview");
  const tabs = useRef<HTMLDivElement>(null);
  return <>
    <DealHeader detail={detail} />
    <div ref={tabs} role="tablist" aria-label="Deal details" className="workspace-tabs flex overflow-x-auto border-b border-border" onKeyDown={event => {
      const index = dealTabs.indexOf(tab);
      const next = event.key === "ArrowRight" ? (index + 1) % dealTabs.length : event.key === "ArrowLeft" ? (index + dealTabs.length - 1) % dealTabs.length : event.key === "Home" ? 0 : event.key === "End" ? dealTabs.length - 1 : undefined;
      if (next === undefined) return;
      event.preventDefault(); setTab(dealTabs[next]); tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>{dealTabs.map(label => <button key={label} type="button" role="tab" id={`deal-tab-${label}`} aria-controls={`deal-panel-${label}`} aria-selected={label === tab} tabIndex={label === tab ? 0 : -1} onClick={() => setTab(label)} className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium focus-visible:-outline-offset-3 ${label === tab ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"}`}>{label}</button>)}</div>
    {dealTabs.map(label => <div key={label} role="tabpanel" id={`deal-panel-${label}`} aria-labelledby={`deal-tab-${label}`} hidden={label !== tab} tabIndex={0} className="rounded-sm">{label === tab && <DealTabContent detail={detail} tab={label} />}</div>)}
  </>;
}

export function DealDetailWorkspace({ dealId }: { dealId: string }) {
  const { deal, accounts, contacts, deals, activities, proposals, audit } = useDealDetailData(dealId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const detail = useMemo(() => deal && accounts.data && contacts.data && deals.data && activities.data && proposals.data && audit.data ? buildDealDetail(deal, accounts.data, contacts.data, deals.data, activities.data, proposals.data, audit.data, now) : null, [deal, accounts.data, contacts.data, deals.data, activities.data, proposals.data, audit.data, now]);
  const queries = [accounts, contacts, deals, activities, proposals, audit];
  const missing = deals.data !== undefined && !deal;
  const failed = queries.some(query => query.isError);
  return <section aria-labelledby={detail ? "deal-title" : "deal-state-title"} className="mx-auto max-w-[1440px] space-y-3 pb-4">
    <Link href="/pipeline" className="inline-block rounded-sm text-xs text-text-muted underline-offset-4 hover:text-accent hover:underline">← Back to Pipeline</Link>
    {!detail && <h1 id="deal-state-title" className="text-lg font-semibold">{missing ? "Deal not found" : "Deal details"}</h1>}
    {failed && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-danger-border bg-danger-soft p-3 text-xs text-danger"><p>{detail ? "Unable to refresh deal data. Showing the last loaded values." : "Unable to load deal data from local storage."}</p><button type="button" disabled={queries.some(query => query.isFetching)} onClick={() => { setNow(new Date()); for (const query of queries) void query.refetch(); }} className="rounded-sm underline disabled:border-dashed">Retry</button></div>}
    {!detail && !missing && !failed && <p role="status" aria-busy="true" className="p-3 text-xs text-text-muted">Loading deal data…</p>}
    {missing && <p className="text-xs text-text-muted">This deal does not exist in your local workspace. Return to Pipeline to choose another opportunity.</p>}
    {detail && <DealDetailView key={detail.deal.id} detail={detail} />}
  </section>;
}

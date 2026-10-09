"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "../../domain/accounts/account";
import type { Deal } from "../../domain/deals/deal";
import { FavoriteButton } from "../favorites/favorite-button";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { websiteUrl } from "../../domain/validation";
import { formatDealValue, formatPipelineDate, stageLabels } from "../pipeline/pipeline-model";
import { buildAccountDetail, pipelineLabel, type AccountDetailData } from "./accounts-model";
import { accountTabs, AccountTabContent, type AccountTab } from "./account-detail-sections";
import { AccountQueryState } from "./account-query-state";
import { useAccountAudit, useAccountContacts, useAccountCore, useAccountProposals } from "./use-account-data";

export function AccountDetailView({ account, data }: { account: Account; data: AccountDetailData }) {
  const [tab, setTab] = useState<AccountTab>("Overview");
  const [openedDealId, setOpenedDealId] = useState<string>();
  const openedDeal = data.opportunities.find(deal => deal.id === openedDealId);
  // One feature-local selection point can become deal navigation when that route exists.
  const openDeal = (deal: Deal) => setOpenedDealId(deal.id);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Browser storage can be edited outside the app: validate again at the URL sink.
  const website = websiteUrl.safeParse(account.website);
  const summary = [["Open pipeline", pipelineLabel(data.pipeline)], ["Open deals", data.open.length], ["Contacts", data.contacts.length], ["Pending reviews", data.pending.length], ["Last activity", formatPipelineDate(data.lastActivityAt)]] as const;
  return <>
    <header className="space-y-2 border-b border-border pb-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><h1 id="account-title" className="text-lg font-semibold tracking-tight text-text">{account.name}</h1><FavoriteButton entityType="account" entityId={account.id} recordName={account.name} /></div><span className="rounded-sm border border-border bg-bg-subtle px-2 py-0.5 text-[11px] text-text">{account.status}</span></div>
      <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">{[["Industry", account.industry || "Not set"], ["Region", account.region || "Not set"], ["Owner", account.ownerId], ["Employees", account.employeeCount === undefined ? "Not set" : account.employeeCount.toLocaleString("en-GB")]].map(([label, value]) => <div key={label}><dt className="inline text-text-muted">{label}: </dt><dd className="inline text-text">{value}</dd></div>)}{account.website && <div className="min-w-0 max-w-full"><dt className="inline text-text-muted">Website: </dt><dd className="inline break-all">{website.success ? <a href={website.data} target="_blank" rel="noopener noreferrer" className="rounded-sm text-accent underline-offset-4 hover:underline">{website.data} <span aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a> : <span className="text-text-muted">Unavailable</span>}</dd></div>}</dl>
    </header>
    <dl aria-label="Account summary" className="workspace-metrics grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-surface-muted lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">{summary.map(([label, value]) => <div key={label} className="min-w-0 bg-bg-subtle px-3 py-3 last:col-span-2 lg:last:col-span-1"><dt className="text-[11px] text-text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-text tabular-nums">{value}</dd></div>)}</dl>
    <div ref={tabsRef} role="tablist" aria-label="Account details" className="workspace-tabs flex overflow-x-auto border-b border-border" onKeyDown={event => {
      const current = accountTabs.indexOf(tab);
      let next: number;
      switch (event.key) {
        case "ArrowRight": next = (current + 1) % accountTabs.length; break;
        case "ArrowLeft": next = (current - 1 + accountTabs.length) % accountTabs.length; break;
        case "Home": next = 0; break;
        case "End": next = accountTabs.length - 1; break;
        default: return;
      }
      event.preventDefault(); setTab(accountTabs[next]); tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>{accountTabs.map(label => <button key={label} type="button" role="tab" id={`account-tab-${label}`} aria-controls={`account-panel-${label}`} aria-selected={tab === label} tabIndex={tab === label ? 0 : -1} onClick={() => setTab(label)} className={`shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium focus-visible:outline-offset-[-3px] ${tab === label ? "border-accent text-accent" : "border-transparent text-text-muted hover:text-text"}`}>{label}</button>)}</div>
    {accountTabs.map(label => <div key={label} role="tabpanel" id={`account-panel-${label}`} aria-labelledby={`account-tab-${label}`} hidden={tab !== label} tabIndex={0} className="rounded-sm">{tab === label && <AccountTabContent tab={label} data={data} onOpenDeal={openDeal} />}</div>)}
    {openedDeal && <WorkspaceDialog title={openedDeal.title} onClose={() => setOpenedDealId(undefined)}><p className="mb-3 text-xs text-text-muted">Opportunity preview · {account.name}</p><dl className="divide-y divide-border text-xs">{Object.entries({ Stage: stageLabels[openedDeal.stage], Value: formatDealValue(openedDeal.value, openedDeal.currency), Probability: `${openedDeal.probability}%`, "Expected close": formatPipelineDate(openedDeal.expectedCloseDate), Risk: openedDeal.risk, "Next step": openedDeal.nextStep || "Not set" }).map(([label, value]) => <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2"><dt className="text-text-muted">{label}</dt><dd className="break-words text-text">{value}</dd></div>)}</dl></WorkspaceDialog>}
  </>;
}

export function AccountDetailWorkspace({ accountId }: { accountId: string }) {
  const { accounts, deals, activities } = useAccountCore();
  const contacts = useAccountContacts(accountId);
  const proposals = useAccountProposals(accountId);
  const audit = useAccountAudit(accountId);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer); }, []);
  const account = accounts.data?.find(item => item.id === accountId);
  const ready = Boolean(account && deals.data && activities.data && contacts.data && proposals.data && audit.data);
  const data = useMemo(() => deals.data && contacts.data && activities.data && proposals.data && audit.data ? buildAccountDetail(accountId, deals.data, contacts.data, activities.data, proposals.data, now, { account, auditEvents: audit.data }) : null, [account, accountId, deals.data, contacts.data, activities.data, proposals.data, audit.data, now]);
  const queries = [accounts, deals, activities, contacts, proposals, audit];
  const missing = accounts.data !== undefined && !account;
  return <section aria-labelledby={account && data ? "account-title" : "account-state-title"} className="mx-auto max-w-[1440px] space-y-3">
    <Link href="/workspace/accounts" className="inline-block rounded-sm text-xs font-medium text-text-muted underline-offset-4 hover:text-accent hover:underline">← All accounts</Link>
    {!(account && data) && <h1 id="account-state-title" className="text-lg font-semibold">{missing ? "Account not found" : "Account details"}</h1>}
    <AccountQueryState failed={queries.some(query => query.isError)} ready={ready || missing} fetching={queries.some(query => query.isFetching)} retry={() => { setNow(new Date()); for (const query of queries) void query.refetch(); }} />
    {missing && <p className="text-sm text-text-muted">This account does not exist in your local workspace. Return to Accounts to choose another company.</p>}
    {account && data && <AccountDetailView account={account} data={data} />}
  </section>;
}

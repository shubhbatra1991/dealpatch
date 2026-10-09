"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Deal } from "../../domain/deals/deal";
import { FavoriteButton } from "../favorites/favorite-button";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { useAccountAudit, useAccountProposals } from "../accounts/use-account-data";
import { accountHref } from "../accounts/accounts-model";
import { AccountActivity } from "../accounts/account-detail-sections";
import { displayTimestamp } from "../reviews/review-format";
import { formatDealValue, formatPipelineDate, stageLabels } from "../pipeline/pipeline-model";
import { ContactsQueryState } from "./contacts-query-state";
import { useContactCore } from "./use-contacts";
import { contactName } from "./contacts-model";
import { buildContactDetail } from "./contact-detail-model";
import { ContactProposals } from "./contact-proposals";

export function ContactDetailView({ detail }: { detail: ReturnType<typeof buildContactDetail> }) {
  const { account, contact, data } = detail;
  const [selectedId, setSelectedId] = useState<string>();
  const selected = data.opportunities.find(deal => deal.id === selectedId);
  const openDeal = (deal: Deal) => setSelectedId(deal.id);
  return <section aria-labelledby="contact-title" className="space-y-3 pb-4">
    <Link href="/contacts" className="inline-block rounded-sm text-xs text-zinc-600 hover:text-zinc-950">← All contacts</Link>
    <header className="border-b border-zinc-200 pb-3"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><h1 id="contact-title" className="text-lg font-semibold tracking-tight">{contactName(contact)}</h1><FavoriteButton entityType="contact" entityId={contact.id} /></div><span className="rounded-sm border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-600">{contact.status}</span></div><dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs">{[
      ["Role", contact.role || "Not set"], ["Account", account ? <Link key="account" href={accountHref(account.id)} className="rounded-sm text-indigo-700 hover:underline">{account.name}</Link> : "Unavailable account"], ["Email", contact.email || "Not set"], ["Phone", contact.phone || "Not set"], ["Region", account?.region || "Not set"],
    ].map(([label, value]) => <div key={String(label)} className="flex gap-1"><dt className="text-zinc-500">{label}:</dt><dd className="break-all text-zinc-700">{value}</dd></div>)}</dl></header>
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      <div className="min-w-0"><AccountActivity activities={data.activities.slice(0, 10)} recent onOpenDeal={openDeal} /></div>
      <section aria-label="Related opportunities" className="min-w-0 rounded-sm border border-zinc-200"><h2 className="border-b border-zinc-100 px-3 py-2.5 text-xs font-semibold">Related opportunities</h2><p className="px-3 pt-2 text-[11px] text-zinc-500">Deals referenced by activities listing this contact as a participant. Includes closed deals.</p>{data.opportunities.length ? <ul className="divide-y divide-zinc-100">{data.opportunities.map(deal => <li key={deal.id} className="px-3 py-3 text-xs"><button type="button" onClick={() => openDeal(deal)} className="rounded-sm text-left font-medium text-indigo-700 hover:underline">{deal.title}</button><p className="mt-1 text-zinc-500">{stageLabels[deal.stage]} · {formatDealValue(deal.value, deal.currency)} · {deal.probability}% probability</p></li>)}</ul> : <p className="p-4 text-xs text-zinc-500">No opportunities linked through this contact’s recorded activity.</p>}</section>
      <div className="min-w-0 xl:col-span-2"><ContactProposals proposals={data.pending} detail={detail} pendingOnly /></div>
      <div className="min-w-0 xl:col-span-2"><ContactProposals proposals={detail.reviewed} detail={detail} /></div>
      <section aria-label="Contact audit history" className="min-w-0 rounded-sm border border-zinc-200 xl:col-span-2"><h2 className="border-b border-zinc-100 px-3 py-2.5 text-xs font-semibold">Contact audit history</h2>{data.auditEvents.length ? <ol className="divide-y divide-zinc-100">{data.auditEvents.map(event => <li key={event.id} className="px-3 py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span>{event.action === "FieldEdited" ? "Suggestion edited" : event.action.replace(/([a-z])([A-Z])/g, "$1 $2")}</span><time dateTime={event.occurredAt} className="text-zinc-500">{displayTimestamp(event.occurredAt)}</time></div><p className="mt-1 text-[11px] text-zinc-500">{event.entityType === "Proposal" ? "Proposal state snapshot (may include other fields in the same proposal)" : "Contact field change"}</p><p className="mt-1 break-all text-zinc-600">{JSON.stringify(event.previousValue)} → {JSON.stringify(event.nextValue)}</p></li>)}</ol> : <p className="p-4 text-xs text-zinc-500">No audit events recorded for this contact. Earlier actions are not reconstructed.</p>}</section>
    </div>
    {selected && <WorkspaceDialog title={selected.title} onClose={() => setSelectedId(undefined)}><p className="mb-3 text-xs text-zinc-500">Opportunity preview · {account?.name ?? "Unavailable account"}</p><dl className="space-y-2 text-xs">{[["Stage", stageLabels[selected.stage]], ["Value", formatDealValue(selected.value, selected.currency)], ["Probability", `${selected.probability}%`], ["Expected close", formatPipelineDate(selected.expectedCloseDate)], ["Risk", selected.risk], ["Next step", selected.nextStep || "Not set"]].map(([label, value]) => <div key={label} className="grid grid-cols-[100px_1fr] gap-3"><dt className="text-zinc-500">{label}</dt><dd>{value}</dd></div>)}</dl></WorkspaceDialog>}
  </section>;
}

export function ContactDetailWorkspace({ contactId }: { contactId: string }) {
  const { contacts, accounts, deals, activities } = useContactCore();
  const contact = contacts.data?.find(contact => contact.id === contactId);
  const proposals = useAccountProposals(contact?.accountId ?? "");
  const audit = useAccountAudit(contact?.accountId ?? "");
  const queries = [contacts, accounts, deals, activities, proposals, audit];
  const detail = useMemo(() => contact && contacts.data && accounts.data && deals.data && activities.data && proposals.data && audit.data ? buildContactDetail(contact, accounts.data, contacts.data, deals.data, activities.data, proposals.data, audit.data, new Date()) : null, [contact, contacts.data, accounts.data, deals.data, activities.data, proposals.data, audit.data]);
  if (contacts.data && !contact) return <section aria-labelledby="contact-missing" className="space-y-3"><Link href="/contacts" className="rounded-sm text-xs text-indigo-700 hover:underline">← All contacts</Link><h1 id="contact-missing" className="text-lg font-semibold">Contact not found</h1><p className="text-xs text-zinc-600">This contact does not exist in your local workspace.</p></section>;
  return <><ContactsQueryState failed={queries.some(query => query.isError)} ready={Boolean(detail)} fetching={queries.some(query => query.isFetching)} retry={() => { for (const query of queries) void query.refetch(); }} />{detail && <ContactDetailView detail={detail} />}</>;
}

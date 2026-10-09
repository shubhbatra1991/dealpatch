import Link from "next/link";
import type { ReactNode } from "react";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { AuditEvent } from "../../domain/audit/audit.types";
import type { Proposal } from "../../domain/proposals/proposal";
import { isUnreviewed } from "../../domain/proposals/review";
import { formatDealValue, formatPipelineDate, stageLabels } from "../pipeline/pipeline-model";
import { displayFieldValue, displayTimestamp, fieldLabel } from "../reviews/review-format";
import type { AccountDetailData } from "./accounts-model";

export const accountTabs = ["Overview", "Contacts", "Opportunities", "Activity", "Changes"] as const;
export type AccountTab = typeof accountTabs[number];
const cell = "border-b border-zinc-100 px-3 py-2 text-xs text-zinc-700";
const heading = "border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600";

function AccountSection({ title, children, href }: { title: string; children: ReactNode; href?: string }) {
  return <section aria-label={title} className="min-w-0 rounded-sm border border-zinc-200 bg-white"><header className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2.5"><h2 className="text-xs font-semibold text-zinc-900">{title}</h2>{href && <Link href={href} className="rounded-sm text-[11px] font-medium text-indigo-700 hover:underline">Open workspace <span aria-hidden="true">↗</span></Link>}</header>{children}</section>;
}
function Empty({ children }: { children: ReactNode }) { return <p className="px-3 py-5 text-xs text-zinc-500">{children}</p>; }

export function AccountContacts({ contacts }: { contacts: Contact[] }) {
  return <AccountSection title="Contacts">{contacts.length ? <div role="region" aria-label="Account contacts, scroll for all fields" tabIndex={0} className="overflow-auto"><table className="w-full min-w-[700px] border-collapse text-left"><caption className="sr-only">Contacts belonging to this account</caption><thead><tr>{["Name", "Role", "Email", "Phone", "Status"].map(label => <th key={label} scope="col" className={heading}>{label}</th>)}</tr></thead><tbody>{contacts.map(contact => <tr key={contact.id} className="hover:bg-zinc-50"><th scope="row" className={`${cell} font-medium`}><Link href="/contacts" className="rounded-sm underline-offset-4 hover:text-indigo-700 hover:underline">{contact.firstName} {contact.lastName}</Link></th><td className={cell}>{contact.role || "—"}</td><td className={cell}>{contact.email || "—"}</td><td className={cell}>{contact.phone || "—"}</td><td className={cell}>{contact.status}</td></tr>)}</tbody></table></div> : <Empty>No contacts for this account yet.</Empty>}</AccountSection>;
}

export function AccountOpportunities({ deals, openOnly = false, onOpenDeal }: { deals: Deal[]; openOnly?: boolean; onOpenDeal?: (deal: Deal) => void }) {
  return <AccountSection title={openOnly ? "Open opportunities" : "Opportunities"} href="/pipeline">{deals.length ? <div role="region" aria-label="Account opportunities, scroll for all fields" tabIndex={0} className="overflow-auto"><table className="w-full min-w-[850px] border-collapse text-left"><caption className="sr-only">{openOnly ? "Open opportunities belonging to this account" : "Opportunities belonging to this account, including closed deals"}</caption><thead><tr>{["Deal", "Stage", "Value", "Probability", "Expected Close", "Risk", "Next Step"].map(label => <th key={label} scope="col" className={heading}>{label}</th>)}</tr></thead><tbody>{deals.map(deal => <tr key={deal.id} className="hover:bg-zinc-50"><th scope="row" className={`${cell} font-medium`}><button type="button" onClick={() => onOpenDeal?.(deal)} className="rounded-sm text-left underline-offset-4 hover:text-indigo-700 hover:underline">{deal.title}</button></th><td className={`${cell} whitespace-nowrap`}>{stageLabels[deal.stage]}</td><td className={`${cell} whitespace-nowrap tabular-nums`}>{formatDealValue(deal.value, deal.currency)}</td><td className={`${cell} whitespace-nowrap tabular-nums`}>{deal.probability}%</td><td className={`${cell} whitespace-nowrap`}>{formatPipelineDate(deal.expectedCloseDate)}</td><td className={`${cell} whitespace-nowrap`}><span aria-hidden="true">{deal.risk === "High" ? "! " : deal.risk === "Medium" ? "◒ " : ""}</span>{deal.risk}</td><td className={cell}>{deal.nextStep || "Not set"}</td></tr>)}</tbody></table></div> : <Empty>No opportunities for this account yet.</Empty>}</AccountSection>;
}

export function AccountActivity({ activities, recent = false, onOpenDeal }: { activities: AccountDetailData["activities"]; recent?: boolean; onOpenDeal?: (deal: Deal) => void }) {
  return <AccountSection title={recent ? "Recent activity" : "Activity history"} href="/activity">{activities.length ? <ol className="divide-y divide-zinc-100">{activities.map(activity => <li key={activity.id} className="px-3 py-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-medium text-zinc-900">{activity.title}</h3><time dateTime={activity.occurredAt} className="text-[10px] text-zinc-500">{displayTimestamp(activity.occurredAt)}</time></div>
    <p className="mt-1 text-[10px] font-medium text-zinc-500">{activity.type}</p><p className="mt-1 text-xs leading-5 text-zinc-600">{activity.summary}</p>
    {activity.dealId && <p className="mt-2 text-[11px] text-zinc-600">Related deal: {activity.relatedDeal ? <button type="button" onClick={() => { if (activity.relatedDeal) onOpenDeal?.(activity.relatedDeal); }} className="rounded-sm font-medium text-indigo-700 underline-offset-4 hover:underline">{activity.relatedDeal.title}</button> : "Unavailable deal"}</p>}
    <div className="mt-1 text-[11px] text-zinc-500">Participants: {activity.participantLabels.length ? <ul className="inline">{activity.participantLabels.map((person, index) => <li key={`${person.id}-${index}`} className="inline">{index > 0 && ", "}{!person.available ? person.name : <Link href="/contacts" className="rounded-sm text-zinc-700 underline-offset-4 hover:text-indigo-700 hover:underline">{person.name}</Link>}</li>)}</ul> : "None recorded"}</div>
  </li>)}</ol> : <Empty>No activity recorded for this account yet.</Empty>}</AccountSection>;
}

const proposalStatus: Record<Proposal["status"], string> = { Pending: "Pending", PartiallyApproved: "Partially approved", Approved: "Approved", Rejected: "Rejected", Superseded: "Superseded" };

export function AccountProposals({ proposals, data, pendingOnly = false }: { proposals: Proposal[]; data: AccountDetailData; pendingOnly?: boolean }) {
  const sources = new Map(data.activities.map(activity => [activity.id, activity]));
  return <AccountSection title={pendingOnly ? "Pending review proposals" : "Proposal history"} href="/reviews">
    {proposals.length ? <ul className="divide-y divide-zinc-200">{proposals.map(proposal => {
      const changes = (data.proposalChanges.get(proposal.id) ?? []).filter(item => !pendingOnly || isUnreviewed(item.change));
      const source = sources.get(proposal.sourceActivityId);
      return <li key={proposal.id} className="px-3 py-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xs font-semibold text-zinc-800">{proposalStatus[proposal.status]}</h3><span className="text-[10px] text-zinc-500">{proposal.confidence}% confidence</span></div>
        <p className="mt-1 text-[10px] text-zinc-500">Generated <time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time></p>
        <p className="mt-1 text-[11px] text-zinc-600">Source: {source ? `${source.type} · ${source.title}` : "Activity unavailable"}</p>
        <ul aria-label="Proposed field changes" className="mt-2 space-y-2">{changes.map(({ change, current, missing, stale }) => <li key={change.id} className="border-l-2 border-indigo-200 pl-2 text-xs">
          <p className="text-[10px] text-zinc-500">{change.entityType} · {fieldLabel(change.field)} · {change.status}</p>
          <p className="mt-0.5 break-words leading-5"><span className="text-zinc-500"><span className="sr-only">Current value: </span>{missing ? "Target unavailable" : displayFieldValue(change.field, current)}</span><span aria-hidden="true" className="mx-1.5 text-zinc-400">→</span><span className="sr-only"> Proposed: </span><span className="font-medium text-zinc-800">{displayFieldValue(change.field, change.after)}</span></p>
          <p className="mt-1 text-[10px] text-zinc-500">Generation snapshot: {displayFieldValue(change.field, change.before)}</p>
          {stale && <p className="mt-1 text-[11px] font-medium text-amber-800">{missing ? "Target missing or outside this account." : "Stale suggestion: current value differs from its snapshot."} Review the conflict before approval.</p>}
        </li>)}</ul>
        {proposal.evidence.map((evidence, index) => <p key={index} className="mt-2 text-[11px] leading-4 text-zinc-600">Evidence: {evidence.text}</p>)}
      </li>;
    })}</ul> : <Empty>{pendingOnly ? "No pending proposals for this account." : "No proposals recorded for this account yet."}</Empty>}
    <p className="border-t border-zinc-100 px-3 py-2 text-[10px] leading-4 text-zinc-500">Current value → Proposed value. Original snapshots remain visible. Approve or reject in the Review Queue.</p>
  </AccountSection>;
}

export function AccountAudit({ events }: { events: AuditEvent[] }) {
  const labels = { ProposalApproved: "Proposal approved", ProposalPartiallyApproved: "Proposal partially approved", ProposalRejected: "Proposal rejected", FieldEdited: "Suggested field edited", ApprovalUndone: "Approval undone" };
  return <AccountSection title="Audit history">{events.length ? <ol className="divide-y divide-zinc-100">{events.map(event => <li key={event.id} className="px-3 py-3"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xs font-medium text-zinc-800">{labels[event.action]}</h3><time dateTime={event.occurredAt} className="text-[10px] text-zinc-500">{displayTimestamp(event.occurredAt)}</time></div><p className="mt-1 text-[10px] text-zinc-500">{event.entityType} · {event.entityId}</p><dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2"><div><dt className="text-zinc-500">Previous</dt><dd className="mt-1 whitespace-pre-wrap break-words font-mono text-zinc-700">{JSON.stringify(event.previousValue, null, 2)}</dd></div><div><dt className="text-zinc-500">Next</dt><dd className="mt-1 whitespace-pre-wrap break-words font-mono text-zinc-800">{JSON.stringify(event.nextValue, null, 2)}</dd></div></dl></li>)}</ol> : <Empty>No audit events recorded for this account. New approvals, rejections, suggestion edits and undo actions will appear here; earlier actions are not reconstructed.</Empty>}</AccountSection>;
}

export function AccountTabContent({ tab, data, onOpenDeal }: { tab: AccountTab; data: AccountDetailData; onOpenDeal?: (deal: Deal) => void }) {
  if (tab === "Contacts") return <AccountContacts contacts={data.contacts} />;
  if (tab === "Opportunities") return <AccountOpportunities deals={data.opportunities} onOpenDeal={onOpenDeal} />;
  if (tab === "Activity") return <AccountActivity activities={data.activities} onOpenDeal={onOpenDeal} />;
  if (tab === "Changes") return <div className="space-y-3"><AccountProposals proposals={data.pending} data={data} pendingOnly /><AccountProposals proposals={data.proposals.filter(proposal => !data.pending.includes(proposal))} data={data} /><AccountAudit events={data.auditEvents} /></div>;
  return <div className="grid items-start gap-3 xl:grid-cols-2">
    <AccountSection title="Current risks / needs attention">{data.risks.length ? <ul className="divide-y divide-zinc-100">{data.risks.map(({ deal, reasons }) => <li key={deal.id} className="px-3 py-2.5"><h3 className="text-xs font-medium text-zinc-800">{deal.title}</h3><p className="mt-1 text-[11px] text-amber-800"><span aria-hidden="true">! </span>{reasons.join(" · ")}</p></li>)}</ul> : <Empty>No open deals are flagged by the current checks.</Empty>}</AccountSection>
    <AccountSection title="Key contacts">{data.keyContacts.length ? <ul className="divide-y divide-zinc-100">{data.keyContacts.map(contact => <li key={contact.id} className="px-3 py-2.5"><h3 className="text-xs font-medium text-zinc-800"><Link href="/contacts" className="rounded-sm underline-offset-4 hover:text-indigo-700 hover:underline">{contact.firstName} {contact.lastName}</Link></h3><p className="mt-1 text-[11px] text-zinc-500">{contact.role || "Role not set"}{contact.email ? ` · ${contact.email}` : ""}</p></li>)}</ul> : <Empty>No active contacts recorded.</Empty>}<p className="border-t border-zinc-100 px-3 py-2 text-[10px] text-zinc-500">Up to four active contacts · alphabetical order</p></AccountSection>
    <AccountOpportunities deals={data.open} openOnly onOpenDeal={onOpenDeal} />
    <AccountProposals proposals={data.pending.slice(0, 3)} data={data} pendingOnly />
    <div className="min-w-0 xl:col-span-2"><AccountActivity activities={data.activities.slice(0, 5)} recent onOpenDeal={onOpenDeal} /></div>
  </div>;
}




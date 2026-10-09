import Link from "next/link";
import type { ReactNode } from "react";
import type { Proposal } from "../../domain/proposals/proposal";
import { isUnreviewed } from "../../domain/proposals/review";
import { displayFieldValue, displayTimestamp, fieldLabel } from "../reviews/review-format";
import { formatPipelineDate, stageLabels } from "../pipeline/pipeline-model";
import type { DealDetail, DealTab } from "./deal-detail-model";

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return <section aria-label={title} className="min-w-0 rounded-sm border border-zinc-200 bg-white"><header className="border-b border-zinc-100 px-3 py-2.5"><h2 className="text-xs font-semibold text-zinc-900">{title}</h2>{note && <p className="mt-1 text-[11px] leading-5 text-zinc-500">{note}</p>}</header>{children}</section>;
}
function Empty({ children }: { children: ReactNode }) { return <p className="p-3 text-xs leading-5 text-zinc-500">{children}</p>; }
const link = "rounded-sm text-indigo-700 underline-offset-4 hover:underline";
const cell = "border-b border-zinc-100 px-3 py-2 text-xs text-zinc-700";

export function DealContacts({ detail, compact = false }: { detail: DealDetail; compact?: boolean }) {
  const people = compact ? detail.contacts.slice(0, 4) : detail.contacts;
  return <Section title={compact ? "Key contacts" : "Deal contacts"} note="Inferred from participation in this deal’s activities.">{people.length ? compact ? <ul className="divide-y divide-zinc-100">{people.map(contact => <li key={contact.id} className="px-3 py-2.5 text-xs"><Link href={`/contacts/${encodeURIComponent(contact.id)}`} className={`${link} font-medium`}>{contact.firstName} {contact.lastName}</Link><p className="mt-1 break-words text-[11px] text-zinc-500">{contact.role || "Role not set"} · {contact.status}</p><p className="mt-1 break-all text-[11px] text-zinc-600">{contact.email || "Email not set"}</p></li>)}</ul> : <div role="region" aria-label="Deal contacts, scroll for all columns" tabIndex={0} className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left"><caption className="sr-only">Contacts participating in deal activities</caption><thead className="bg-zinc-50"><tr>{["Name", "Role", "Email", "Status", "Last related activity"].map(label => <th key={label} scope="col" className={`${cell} font-medium`}>{label}</th>)}</tr></thead><tbody>{people.map(contact => <tr key={contact.id} className="hover:bg-zinc-50 focus-within:bg-indigo-50/50"><th scope="row" className={`${cell} font-medium`}><Link href={`/contacts/${encodeURIComponent(contact.id)}`} className={link}>{contact.firstName} {contact.lastName}</Link></th><td className={cell}>{contact.role || "—"}</td><td className={cell}>{contact.email || "—"}</td><td className={cell}>{contact.status}</td><td className={cell}>{formatPipelineDate(contact.lastRelatedActivityAt)}</td></tr>)}</tbody></table></div> : <Empty>No contacts linked through this deal’s recorded activity.</Empty>}</Section>;
}

export function DealActivity({ detail, recent = false }: { detail: DealDetail; recent?: boolean }) {
  const history = recent ? detail.activities.slice(0, 5) : detail.activities;
  return <Section title={recent ? "Recent activity" : "Activity history"}>{history.length ? <ol className="divide-y divide-zinc-100">{history.map(activity => <li key={activity.id} className="space-y-1 px-3 py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium"><Link href={`/activity?activity=${encodeURIComponent(activity.id)}`} className={link}>{activity.title}</Link></h3><time dateTime={activity.occurredAt} className="text-[10px] text-zinc-500">{displayTimestamp(activity.occurredAt)}</time></div><p className="text-[10px] font-medium uppercase text-zinc-500">{activity.type}</p><p className={`${recent ? "line-clamp-2 " : "whitespace-pre-wrap "}break-words leading-5 text-zinc-600`}>{activity.summary}</p><p className="text-[11px] text-zinc-500">Participants: {activity.participantLabels.length ? activity.participantLabels.map((person, index) => <span key={`${person.id}-${index}`}>{index > 0 && ", "}{person.available ? <Link href={`/contacts/${encodeURIComponent(person.id)}`} className={link}>{person.name}</Link> : person.name}</span>) : "None recorded"}</p></li>)}</ol> : <Empty>No activity recorded for this deal yet.</Empty>}</Section>;
}

export function DealReviews({ detail, pendingOnly = false }: { detail: DealDetail; pendingOnly?: boolean }) {
  const proposals = pendingOnly ? detail.pending : detail.proposals;
  const sources = new Map(detail.sourceActivities.map(activity => [activity.id, activity]));
  return <Section title={pendingOnly ? "Pending reviews" : "Review history"}>{proposals.length ? <ul className="divide-y divide-zinc-200">{proposals.map((proposal: Proposal) => {
    const source = sources.get(proposal.sourceActivityId);
    const changes = (detail.proposalChanges.get(proposal.id) ?? []).filter(item => !pendingOnly || isUnreviewed(item.change));
    return <li key={proposal.id} className="space-y-2 px-3 py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{proposal.status === "PartiallyApproved" ? "Partially approved" : proposal.status}</span><span className="text-[10px] text-zinc-500">{proposal.confidence}% demo confidence · <time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time></span></div><p className="text-[11px] text-zinc-500">Source: {source ? <Link href={`/activity?activity=${encodeURIComponent(source.id)}`} className={link}>{source.type} · {source.title}</Link> : "Activity unavailable"}</p><ul aria-label="Proposed field changes" className="space-y-2">{changes.map(({ change, current, missing, stale }) => <li key={change.id} className="border-l-2 border-indigo-200 pl-2"><p className="text-[10px] text-zinc-500">{change.entityType} · {fieldLabel(change.field)} · {change.status}{change.edited && change.status !== "Edited" && " · Edited"}</p><p className="mt-1 break-words leading-5"><span className="sr-only">Current value: </span><span className="text-zinc-500">{missing ? "Target unavailable" : displayFieldValue(change.field, current)}</span><span aria-hidden="true"> → </span><span className="sr-only">Proposed value: </span><strong className="font-medium">{displayFieldValue(change.field, change.after)}</strong></p><p className="mt-1 text-[10px] text-zinc-500">Original captured value: {displayFieldValue(change.field, change.before)}</p>{stale && <p className="mt-1 text-[11px] text-amber-800">Stale suggestion. Review the current-value conflict before approval.</p>}</li>)}</ul>{proposal.evidence.map((evidence, index) => <p key={index} className="break-words text-[11px] leading-5 text-zinc-600">Evidence: {evidence.text}</p>)}<Link href={`/reviews?proposal=${encodeURIComponent(proposal.id)}`} className={`${link} inline-block text-[11px]`}>Open in Review Queue</Link></li>;
  })}</ul> : <Empty>{pendingOnly ? "No pending reviews for this deal." : "No proposals recorded for this deal yet."}</Empty>}</Section>;
}

export function DealChanges({ detail }: { detail: DealDetail }) {
  const labels = { ProposalApproved: "Proposal approved", ProposalPartiallyApproved: "Proposal partially approved", ProposalRejected: "Proposal rejected", FieldEdited: "Proposed value edited", ApprovalUndone: "Approval undone" };
  return <Section title="Change history" note="Append-only audit events. Undo adds an event and preserves the original action.">{detail.auditEvents.length ? <ol className="divide-y divide-zinc-100">{detail.auditEvents.map(event => <li key={event.id} className="space-y-2 px-3 py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-medium">{labels[event.action]}</h3><time dateTime={event.occurredAt} className="text-[10px] text-zinc-500">{displayTimestamp(event.occurredAt)}</time></div><p className="break-words text-[11px] text-zinc-500">{event.entityType} · {event.entityId}{event.entityType === "Proposal" && " · Proposal state snapshot (may include other fields in the same proposal)"}</p><dl className="grid gap-2 sm:grid-cols-2">{[["Previous value", event.previousValue], ["Next value", event.nextValue]].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-[10px] text-zinc-500">{String(label)}</dt><dd className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-zinc-50 p-2 font-mono text-[11px]">{JSON.stringify(value, null, 2)}</dd></div>)}</dl>{event.proposalId && <Link href={`/reviews?proposal=${encodeURIComponent(event.proposalId)}`} className={`${link} inline-block text-[11px]`}>Related proposal</Link>}</li>)}</ol> : <Empty>No audit events recorded for this deal. Earlier actions are not reconstructed.</Empty>}</Section>;
}

export function DealTabContent({ detail, tab }: { detail: DealDetail; tab: DealTab }) {
  if (tab === "Activity") return <DealActivity detail={detail} />;
  if (tab === "Contacts") return <DealContacts detail={detail} />;
  if (tab === "Reviews") return <DealReviews detail={detail} />;
  if (tab === "Changes") return <DealChanges detail={detail} />;
  const { account, deal } = detail;
  return <div className="grid items-start gap-3 lg:grid-cols-2">
    <Section title="Deal health"><div className="p-3 text-xs"><p className="text-zinc-500">{stageLabels[deal.stage]} · {deal.risk} risk</p>{detail.signals.length ? <ul className="mt-2 space-y-1.5">{detail.signals.map(signal => <li key={signal} className="text-amber-800"><span aria-hidden="true">! </span>{signal}</li>)}</ul> : <p className="mt-2 text-zinc-600">No attention signals from the current checks.</p>}</div></Section>
    <Section title="Next step"><p className={`whitespace-pre-wrap break-words p-3 text-xs leading-6 ${deal.nextStep?.trim() ? "text-zinc-700" : "font-medium text-amber-800"}`}>{deal.nextStep?.trim() || "No next step defined"}</p></Section>
    <DealContacts detail={detail} compact />
    <DealReviews detail={detail} pendingOnly />
    <div className="min-w-0 lg:col-span-2"><Section title="Account context">{account ? <dl className="flex flex-wrap gap-x-8 gap-y-3 p-3 text-xs">{[["Account", <Link key="name" href={`/accounts/${encodeURIComponent(account.id)}`} className={link}>{account.name}</Link>], ["Industry", account.industry || "Not set"], ["Region", account.region || "Not set"], ["Status", account.status], ["Owner", account.ownerId]].map(([label, value]) => <div key={String(label)}><dt className="text-[10px] text-zinc-500">{label}</dt><dd className="mt-1 text-zinc-700">{value}</dd></div>)}</dl> : <Empty>The related account is unavailable.</Empty>}</Section></div>
    <div className="min-w-0 lg:col-span-2"><DealActivity detail={detail} recent /></div>
  </div>;
}


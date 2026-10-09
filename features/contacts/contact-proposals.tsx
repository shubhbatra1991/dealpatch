import Link from "next/link";
import type { Proposal } from "../../domain/proposals/proposal";
import { isUnreviewed } from "../../domain/proposals/review";
import { displayFieldValue, displayTimestamp, fieldLabel } from "../reviews/review-format";
import type { buildContactDetail } from "./contact-detail-model";

export function ContactProposals({ detail, proposals, pendingOnly = false }: { detail: ReturnType<typeof buildContactDetail>; proposals: Proposal[]; pendingOnly?: boolean }) {
  const sources = new Map(detail.sourceActivities.map(activity => [activity.id, activity]));
  return <section aria-label={pendingOnly ? "Pending contact proposals" : "Contact proposal history"} className="workspace-panel min-w-0 rounded-sm border border-border bg-surface">
    <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5"><h2 className="text-xs font-semibold">{pendingOnly ? "Pending contact proposals" : "Contact proposal history"}</h2><Link href="/workspace/reviews" className="rounded-sm text-[11px] text-accent hover:underline">Review Queue</Link></header>
    {proposals.length ? <ul className="divide-y divide-border">{proposals.map(proposal => {
      const source = sources.get(proposal.sourceActivityId);
      const changeIds = new Set(proposal.changes.map(change => change.id));
      const changes = (detail.data.proposalChanges.get(proposal.id) ?? []).filter(item => changeIds.has(item.change.id) && (!pendingOnly || isUnreviewed(item.change)));
      return <li key={proposal.id} className="space-y-2 px-3 py-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium">{proposal.status === "PartiallyApproved" ? "Partially approved" : proposal.status}</span><span className="text-text-muted">{proposal.confidence}% confidence · <time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time></span></div>
        <p className="text-[11px] text-text-muted">Source: {source ? `${source.type} · ${source.title}` : "Activity unavailable"}</p>
        <ul aria-label="Contact field changes" className="space-y-2">{changes.map(({ change, current, missing, stale }) => <li key={change.id} className="border-l-2 border-accent pl-2"><p className="text-[10px] text-text-muted">{fieldLabel(change.field)} · {change.status}</p><p className="mt-1 break-words"><span className="sr-only">Current value: </span>{missing ? "Target unavailable" : displayFieldValue(change.field, current)}<span aria-hidden="true"> → </span><span className="sr-only"> Proposed: </span><strong className="font-medium">{displayFieldValue(change.field, change.after)}</strong></p><p className="mt-1 text-[10px] text-text-muted">Generation snapshot: {displayFieldValue(change.field, change.before)}</p>{stale && <p className="mt-1 text-[11px] text-warning">Stale suggestion. Review the current-value conflict before approval.</p>}</li>)}</ul>
        {proposal.evidence.map((evidence, index) => <p key={index} className="text-[11px] leading-5 text-text-muted">Evidence: {evidence.text}</p>)}
      </li>;
    })}</ul> : <p className="p-4 text-xs text-text-muted">{pendingOnly ? "No pending proposals targeting this contact." : "No reviewed proposals targeting this contact."}</p>}
  </section>;
}

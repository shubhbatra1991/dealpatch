import Link from "next/link";
import type { ReviewHistoryEntry } from "./review-history-model";
import { auditFieldDiffs, reviewHistoryHref } from "./review-history-model";
import { displayFieldValue, displayTimestamp, fieldLabel } from "./review-format";

export function ReviewHistoryItem({ entry, expanded = false }: { entry: ReviewHistoryEntry; expanded?: boolean }) {
  const { item, fields, status, reviewedAt, events } = entry;
  const { proposal } = item;
  return <li className="border-b border-border last:border-b-0"><details open={expanded || undefined} className="px-3 py-3">
    <summary className="cursor-pointer rounded-sm text-xs"><strong>{item.account}</strong> · {item.deal ?? "Account-level proposal"} · {status}{entry.hasUndo && status !== "Undone / Reverted" ? " · Includes Undo history" : ""}<span className="ml-2 text-text-muted">· {proposal.confidence}% confidence</span></summary>
    <article aria-label={`Review history · ${item.account}`} className="mt-3 space-y-3 text-xs">
      <p className="text-text-muted">Proposal created: <time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time> · {reviewedAt ? <>Last reviewed: <time dateTime={reviewedAt}>{displayTimestamp(reviewedAt)}</time></> : "Review timestamp unavailable"}</p>
      <p>Final outcome: <strong>{status}</strong>{proposal.status === "Pending" && entry.reverted ? " · Returned to Review Queue for a new decision." : ""}</p>
      {proposal.status === "Rejected" && <p className="font-medium">CRM data was not changed.</p>}
      {proposal.status === "PartiallyApproved" && <p>Applied fields are preserved; skipped or rejected fields were not applied by this decision.</p>}
      <nav aria-label="History related records" className="flex flex-wrap gap-3 text-accent">
        <Link href={`/workspace/accounts/${encodeURIComponent(proposal.accountId)}`} className="rounded-sm underline">View account</Link>
        {proposal.dealId && <Link href={`/workspace/deals/${encodeURIComponent(proposal.dealId)}`} className="rounded-sm underline">View deal</Link>}
        <Link href={`/workspace/activity?activity=${encodeURIComponent(proposal.sourceActivityId)}`} className="rounded-sm underline">View source activity</Link>
        <Link href={reviewHistoryHref(proposal.id)} className="rounded-sm underline">Link to this review</Link>
      </nav>
      <p>Source activity: {item.source?.title ?? `Unavailable · ${proposal.sourceActivityId}`}</p>
      <section aria-label="Supporting evidence"><h2 className="font-semibold">Supporting evidence</h2>{proposal.evidence.map((evidence, index) => <blockquote key={index} className="mt-2 border-l-2 border-border-strong pl-3 leading-5 text-text-muted">{evidence.text}</blockquote>)}</section>
      <section aria-label="Field outcomes"><h2 className="font-semibold">Field outcomes</h2><ul className="divide-y divide-border">{fields.map(({ change, current, outcome, edited }) => <li key={change.id} className="space-y-1 py-2">
        <p><strong>{fieldLabel(change.field)}</strong> · {outcome}{outcome === "Skipped" ? " · Not applied" : ""}{edited ? " · Edited suggestion" : ""}</p>
        <p className="text-text-muted">{change.entityType} · {change.entityId}</p>
        <p className="break-words">Captured: {displayFieldValue(change.field, change.before)} <span aria-hidden="true">→</span><span className="sr-only">to</span> Proposed: {displayFieldValue(change.field, change.after)}</p>
        <p className="break-words">Current value: {displayFieldValue(change.field, current)}</p>
      </li>)}</ul><p className="text-[11px] text-text-muted">Current values may include later changes. The audit trail preserves values at each decision.</p></section>
      <section aria-label="Review audit trail"><h2 className="font-semibold">Audit trail</h2>{!events.length && <p className="mt-2 text-text-muted">No audit events recorded. Earlier decisions are not reconstructed.</p>}<ol className="divide-y divide-border">{events.map(event => <li key={event.id} className="space-y-1 py-2">
        <p className="font-medium">{fieldLabel(event.action)} · <time dateTime={event.occurredAt}>{displayTimestamp(event.occurredAt)}</time></p>
        <p className="text-text-muted">{event.entityType} · {event.entityId}</p>
        {auditFieldDiffs(event).map(diff => <p key={diff.field} className="break-words">{fieldLabel(diff.field)}: {displayFieldValue(diff.field, diff.previous)} <span aria-hidden="true">→</span><span className="sr-only">to</span> {displayFieldValue(diff.field, diff.next)}</p>)}
        <details><summary className="cursor-pointer">Previous and next values</summary><dl className="mt-2 grid gap-2 sm:grid-cols-2"><div><dt>Previous value</dt><dd><pre className="whitespace-pre-wrap break-words">{JSON.stringify(event.previousValue, null, 2)}</pre></dd></div><div><dt>Next value</dt><dd><pre className="whitespace-pre-wrap break-words">{JSON.stringify(event.nextValue, null, 2)}</pre></dd></div></dl></details>
      </li>)}</ol></section>
    </article>
  </details></li>;
}

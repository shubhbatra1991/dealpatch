"use client";

import { useAccountAudit } from "../accounts/use-account-data";
import { displayTimestamp, fieldLabel } from "./review-format";

export function ReviewAudit({ accountId, proposalId }: { accountId: string; proposalId: string }) {
  const audit = useAccountAudit(accountId);
  const events = audit.data?.filter(event => event.proposalId === proposalId) ?? [];
  return <details className="border-t border-border px-3 py-3 text-xs sm:px-4">
    <summary className="cursor-pointer font-medium">Audit trail · {events.length} {events.length === 1 ? "event" : "events"}</summary>
    <p className="mt-2 text-[11px] text-text-muted">History is append-only. Undo creates a new event and preserves the original decision.</p>
    {audit.isError ? <p role="alert" className="mt-2 text-danger">Unable to load audit history. <button type="button" onClick={() => void audit.refetch()} className="underline">Retry</button></p> : audit.isPending ? <p role="status" className="mt-2 text-text-muted">Loading audit history…</p> : !events.length && <p className="mt-2 text-text-muted">No review decisions recorded yet.</p>}
    <ol className="mt-2 divide-y divide-border">{events.map(event => <li key={event.id} className="space-y-1 py-2">
      <p className="font-medium">{fieldLabel(event.action)} · <time dateTime={event.occurredAt}>{displayTimestamp(event.occurredAt)}</time></p>
      <p className="text-text-muted">{event.entityType} · {event.entityId}</p>
      <details><summary className="cursor-pointer text-text-muted">Previous and next values</summary><dl className="mt-1 space-y-1"><dt>Previous value</dt><dd><pre className="whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(event.previousValue, null, 2)}</pre></dd><dt>Next value</dt><dd><pre className="whitespace-pre-wrap break-words text-[11px]">{JSON.stringify(event.nextValue, null, 2)}</pre></dd></dl></details>
    </li>)}</ol>
  </details>;
}

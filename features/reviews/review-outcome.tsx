import type { Proposal } from "../../domain/proposals/proposal";
import { displayFieldValue, fieldLabel } from "./review-format";

/** Persisted field decisions, also used by the session approval/Undo notice. */
export function ReviewOutcome({ proposal, changeIds }: { proposal: Proposal; changeIds?: string[] }) {
  return <div className="mt-2 text-[11px]">
    <p className="font-medium text-text">{proposal.status === "PartiallyApproved" ? "Partially approved" : proposal.status === "Approved" ? "Approval complete" : proposal.status === "Rejected" ? "Proposal rejected" : proposal.status === "Superseded" ? "Proposal superseded" : "Review state"}</p>
    <ul className="mt-1 divide-y divide-border">{proposal.changes.map(change => <li key={change.id} className="py-1.5">
      <p className="flex flex-wrap gap-x-2"><strong className="font-medium">{fieldLabel(change.field)}</strong><span>{change.status === "Approved" ? changeIds && !changeIds.includes(change.id) ? "Applied earlier" : "Applied" : change.status === "Rejected" ? "Rejected · not applied" : proposal.status === "Superseded" ? "Skipped · superseded" : "Skipped · awaiting review"}</span>{(change.edited || change.status === "Edited") && <span className="text-accent">Edited suggestion</span>}</p>
      <p className="mt-0.5 break-words text-text-muted">{change.entityType} · {change.entityId}</p>
      <p className="mt-0.5 whitespace-pre-wrap break-words"><span className="text-text-muted">Captured: </span>{displayFieldValue(change.field, change.before)}<span aria-hidden="true"> → </span><span className="sr-only"> to </span><span className="text-text-muted">{change.status === "Approved" ? "Applied" : "Proposed"}: </span>{displayFieldValue(change.field, change.after)}</p>
    </li>)}</ul>
  </div>;
}

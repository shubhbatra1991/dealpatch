"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useWorkspaceKeyboard, useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { isTypingTarget, workspaceAction } from "../../lib/utils/keyboard";
import { isUnreviewed, type ReviewItem } from "../../lib/repositories/reviews";
import { ReviewChangeRow, reviewButton, reviewPrimaryButton } from "./review-change";
import { displayTimestamp } from "./review-format";
import { useReviewCardActions } from "./use-review-card-actions";
import { isPendingReview, proposalStatusLabel } from "./review-model";
import { ReviewOutcome } from "./review-outcome";
import { ReviewAudit } from "./review-audit";

export function ReviewCard({ item, onReviewed, active, onActivate, dialogOpen, onOpenChange, restoreFocus }: { item: ReviewItem; onReviewed: (message: string) => void; active: boolean; onActivate: () => void; dialogOpen?: boolean; onOpenChange?: (open: boolean) => void; restoreFocus?: () => void }) {
  const { proposal } = item;
  const { singleKeys } = useWorkspaceKeyboard();
  const mutation = useReviewCardActions(item, onReviewed);
  // Selection is transient; saved proposal selection only supplies the initial choice.
  const [selection, setSelection] = useState(() => new Set(proposal.changes.filter(c => c.selected && isUnreviewed(c)).map(c => c.id)));
  const actionable = isPendingReview(proposal);
  const pending = actionable ? item.changes.filter(c => isUnreviewed(c.change)) : [];
  const eligible = pending.filter(c => !c.conflict);
  const stale = pending.length - eligible.length;
  const selected = eligible.filter(c => selection.has(c.change.id)).map(c => c.change.id);
  const [localOpen, setLocalOpen] = useState(false);
  const open = dialogOpen ?? localOpen;
  function setOpen(value: boolean) { if (onOpenChange) onOpenChange(value); else setLocalOpen(value); }
  const article = useRef<HTMLElement>(null);
  const actions = {
    open: () => setOpen(true),
    approve: () => { if (!mutation.isPending && actionable && selected.length) { setOpen(false); void mutation.approve(selected); } },
    reject: () => { if (!mutation.isPending && actionable) { setOpen(false); void mutation.reject(); } },
  };
  useWorkspaceShortcuts(actions, active);
  const content = <article ref={article} id={`${proposal.id}-review`} tabIndex={0} onFocusCapture={onActivate} onPointerDown={onActivate} aria-labelledby={`${proposal.id}-title ${proposal.id}-deal`} aria-busy={mutation.isPending} className={`workspace-review overflow-hidden rounded-sm border bg-surface ${active ? "border-accent" : "border-border"}`}>
    <header className="flex flex-wrap items-start justify-between gap-2 bg-bg-subtle/70 px-3 py-3 sm:px-4">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id={`${proposal.id}-title`} className="text-sm font-semibold">{item.account}</h2><span className="text-xs text-text-muted">{proposal.status === "Pending" ? "Pending review" : proposalStatusLabel(proposal.status)}</span>{stale > 0 && <strong className="text-xs text-warning">{stale} stale {stale === 1 ? "change" : "changes"} · review required</strong>}</div><p id={`${proposal.id}-deal`} className="mt-1 break-words text-xs text-text-muted">{item.deal ?? "Account-level proposal"}</p></div>
      <div className="text-xs text-text-muted"><p>Generated · <time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time></p><p className="mt-1">Confidence <strong className="font-medium text-text">{proposal.confidence}%</strong> <span title="Simulated confidence describes a suggestion, not its correctness.">· simulated</span></p></div>
    </header>
    <nav aria-label="Related records" className="flex flex-wrap gap-3 border-t border-border px-3 py-2 text-xs sm:px-4">
      <Link href={`/accounts/${encodeURIComponent(proposal.accountId)}`} className="rounded-sm text-accent underline">View account</Link>
      {proposal.dealId && <Link href={`/deals/${encodeURIComponent(proposal.dealId)}`} className="rounded-sm text-accent underline">View deal</Link>}
      <Link href={`/activity?activity=${encodeURIComponent(proposal.sourceActivityId)}`} className="rounded-sm text-accent underline">View source activity</Link>
    </nav>
    <div className="border-t border-border px-3 py-3 sm:px-4">
      <h3 className="text-xs font-semibold text-text">Source activity</h3>
      {item.source ? <><p className="mt-1 text-xs text-text">{item.source.type} · {item.source.title} <span className="text-text-muted">· <time dateTime={item.source.occurredAt}>{displayTimestamp(item.source.occurredAt)}</time></span></p><p className="mt-1 text-xs leading-5 text-text-muted">{item.source.summary}</p></> : <p className="mt-1 text-xs text-warning">Source unavailable · {proposal.sourceActivityId}</p>}
      <h3 className="mt-3 text-xs font-semibold text-text">Supporting evidence</h3>
      {proposal.evidence.map((evidence, index) => <blockquote key={`${evidence.sourceActivityId}-${index}`} className="workspace-evidence mt-2 border-l-2 border-border-strong pl-3 text-xs leading-5 text-text-muted"><p>{evidence.text}</p><footer className="text-[11px] text-text-muted">Activity excerpt · {evidence.sourceActivityId}{evidence.sourceActivityId === proposal.sourceActivityId ? " · source above" : ""}</footer></blockquote>)}
    </div>
    {proposal.status !== "Pending" && <section aria-label="Review outcome" className="border-t border-border px-3 py-2 sm:px-4"><ReviewOutcome proposal={proposal} /></section>}
    <p role="status" aria-atomic="true" className="sr-only">{stale > 0 ? `Conflict detected. ${stale} stale ${stale === 1 ? "change is" : "changes are"} blocked. Compare original captured, current and proposed values before reviewing again.` : ""}</p>
    <fieldset disabled={mutation.isPending} className="min-w-0">
      <legend className="sr-only">Proposed changes for {item.account}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg-subtle/50 px-3 py-2 text-xs sm:px-4"><h3 className="font-semibold text-text">Field changes · {pending.length} awaiting review</h3><button type="button" className="text-text-muted underline underline-offset-4 disabled:border-dashed" disabled={eligible.length === 0} onClick={() => setSelection(new Set(selected.length === eligible.length ? [] : eligible.map(c => c.change.id)))}>{selected.length === eligible.length && eligible.length ? "Deselect all" : "Select all available"}</button></div>
      <ul>{item.changes.map(change => <ReviewChangeRow key={change.change.id} item={change} readOnly={!actionable} selected={selected.includes(change.change.id)} disabled={mutation.isPending} onSelect={checked => setSelection(current => { const next = new Set(current); if (checked) next.add(change.change.id); else next.delete(change.change.id); return next; })} onSave={value => mutation.save(change.change.id, value)} />)}</ul>
    </fieldset>
    <footer className="border-t border-border px-3 py-3 sm:px-4">
      {mutation.error && <p role="alert" className="mb-3 text-xs text-danger">{mutation.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!open && <button type="button" onClick={actions.open} className={reviewButton}>Open review</button>}
        <button type="button" disabled={mutation.isPending || !pending.length || eligible.length !== pending.length} onClick={() => void mutation.approve(pending.map(c => c.change.id))} className={reviewPrimaryButton}>Approve all ({pending.length})</button>
        <button type="button" disabled={mutation.isPending || !selected.length} onClick={() => void mutation.approve(selected)} className={reviewButton}>Approve selected ({selected.length})</button>
        <button type="button" disabled={mutation.isPending || !actionable} onClick={() => void mutation.reject()} className={`${reviewButton} ml-auto`}>Reject {proposal.status === "PartiallyApproved" ? "remaining" : "proposal"}</button>
      </div>
      <p className="mt-2 text-[11px] text-text-muted">{mutation.isPending ? "Saving review…" : "Approval applies exactly the selected values. Skipped fields stay awaiting review; rejection preserves earlier approvals and all change history."}</p>
    </footer>
    <ReviewAudit accountId={proposal.accountId} proposalId={proposal.id} />
  </article>;
  return open ? <WorkspaceDialog title={`Review · ${item.account}`} onClose={() => setOpen(false)} restoreFocus={() => { if (restoreFocus) { restoreFocus(); return; } if (article.current) article.current.focus(); else document.getElementById("main-content")?.focus(); }} onKeyDown={event => {
    if (!singleKeys || event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTypingTarget(event.target)) return;
    const action = workspaceAction(event.key, event.repeat);
    if (action === "approve" || action === "reject") { event.preventDefault(); actions[action](); }
  }}>{content}</WorkspaceDialog> : content;
}

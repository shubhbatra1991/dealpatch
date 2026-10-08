"use client";

import { useRef, useState } from "react";
import { useWorkspaceKeyboard, useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { isTypingTarget, workspaceAction } from "../../lib/utils/keyboard";
import { isUnreviewed, type ReviewItem } from "../../lib/repositories/reviews";
import { ReviewChangeRow, reviewButton, reviewPrimaryButton } from "./review-change";
import { displayTimestamp } from "./review-format";
import { useReviewCardActions } from "./use-review-card-actions";

export function ReviewCard({ item, onReviewed, active, onActivate }: { item: ReviewItem; onReviewed: (message: string) => void; active: boolean; onActivate: () => void }) {
  const { proposal } = item;
  const { singleKeys } = useWorkspaceKeyboard();
  const mutation = useReviewCardActions(item, onReviewed);
  // Selection is transient; saved proposal selection only supplies the initial choice.
  const [selection, setSelection] = useState(() => new Set(proposal.changes.filter(c => c.selected && isUnreviewed(c)).map(c => c.id)));
  const pending = item.changes.filter(c => isUnreviewed(c.change));
  const eligible = pending.filter(c => !c.conflict);
  const selected = eligible.filter(c => selection.has(c.change.id)).map(c => c.change.id);
  const [open, setOpen] = useState(false);
  const article = useRef<HTMLElement>(null);
  const actions = {
    open: () => setOpen(true),
    approve: () => { if (!mutation.isPending && selected.length) { setOpen(false); void mutation.approve(selected); } },
    reject: () => { if (!mutation.isPending) { setOpen(false); void mutation.reject(); } },
  };
  useWorkspaceShortcuts(actions, active);
  const content = <article ref={article} id={`${proposal.id}-review`} tabIndex={0} onFocusCapture={onActivate} onPointerDown={onActivate} aria-labelledby={`${proposal.id}-title ${proposal.id}-deal`} aria-busy={mutation.isPending} className={`overflow-hidden rounded-sm border bg-white ${active ? "border-indigo-500 ring-1 ring-indigo-200" : "border-zinc-200"}`}>
    <header className="flex flex-wrap items-start justify-between gap-2 bg-zinc-50/70 px-3 py-3 sm:px-4">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id={`${proposal.id}-title`} className="text-sm font-semibold">{item.account}</h2><span className="text-xs text-zinc-500">{proposal.status === "PartiallyApproved" ? "Partially approved" : "Pending review"}</span></div><p id={`${proposal.id}-deal`} className="mt-1 break-words text-xs text-zinc-600">{item.deal ?? "Account-level proposal"}</p></div>
      <div className="text-xs text-zinc-500"><p>Generated · <time dateTime={proposal.createdAt}>{displayTimestamp(proposal.createdAt)}</time></p><p className="mt-1">Confidence <strong className="font-medium text-zinc-700">{proposal.confidence}%</strong> <span title="Simulated confidence describes a suggestion, not its correctness.">· simulated</span></p></div>
    </header>
    <div className="border-t border-zinc-200 px-3 py-3 sm:px-4">
      <h3 className="text-xs font-semibold text-zinc-800">Source activity</h3>
      {item.source ? <><p className="mt-1 text-xs text-zinc-700">{item.source.type} · {item.source.title} <span className="text-zinc-500">· <time dateTime={item.source.occurredAt}>{displayTimestamp(item.source.occurredAt)}</time></span></p><p className="mt-1 text-xs leading-5 text-zinc-500">{item.source.summary}</p></> : <p className="mt-1 text-xs text-amber-900">Source unavailable · {proposal.sourceActivityId}</p>}
      <h3 className="mt-3 text-xs font-semibold text-zinc-800">Supporting evidence</h3>
      {proposal.evidence.map((evidence, index) => <blockquote key={`${evidence.sourceActivityId}-${index}`} className="mt-2 border-l-2 border-zinc-300 pl-3 text-xs leading-5 text-zinc-600"><p>{evidence.text}</p><footer className="text-[11px] text-zinc-500">Activity excerpt · {evidence.sourceActivityId}{evidence.sourceActivityId === proposal.sourceActivityId ? " · source above" : ""}</footer></blockquote>)}
    </div>
    <fieldset disabled={mutation.isPending} className="min-w-0">
      <legend className="sr-only">Proposed changes for {item.account}</legend>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs sm:px-4"><h3 className="font-semibold text-zinc-700">Field changes · {pending.length} awaiting review</h3><button type="button" className="text-zinc-600 underline underline-offset-4 disabled:opacity-40" disabled={eligible.length === 0} onClick={() => setSelection(new Set(selected.length === eligible.length ? [] : eligible.map(c => c.change.id)))}>{selected.length === eligible.length && eligible.length ? "Deselect all" : "Select all available"}</button></div>
      <ul>{item.changes.map(change => <ReviewChangeRow key={change.change.id} item={change} selected={selected.includes(change.change.id)} disabled={mutation.isPending} onSelect={checked => setSelection(current => { const next = new Set(current); if (checked) next.add(change.change.id); else next.delete(change.change.id); return next; })} onSave={value => mutation.save(change.change.id, value)} />)}</ul>
    </fieldset>
    <footer className="border-t border-zinc-200 px-3 py-3 sm:px-4">
      {mutation.error && <p role="alert" className="mb-3 text-xs text-red-800">{mutation.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {!open && <button type="button" onClick={actions.open} className={reviewButton}>Open review</button>}
        <button type="button" disabled={mutation.isPending || !pending.length || eligible.length !== pending.length} onClick={() => void mutation.approve(pending.map(c => c.change.id))} className={reviewPrimaryButton}>Approve all ({pending.length})</button>
        <button type="button" disabled={mutation.isPending || !selected.length} onClick={() => void mutation.approve(selected)} className={reviewButton}>Approve selected ({selected.length})</button>
        <button type="button" disabled={mutation.isPending} onClick={() => void mutation.reject()} className={`${reviewButton} ml-auto`}>Reject {proposal.status === "PartiallyApproved" ? "remaining" : "proposal"}</button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">{mutation.isPending ? "Saving review…" : "Approval applies exactly the values above. Rejection discards pending suggestions only."}</p>
    </footer>
  </article>;
  return open ? <WorkspaceDialog title={`Review · ${item.account}`} onClose={() => setOpen(false)} restoreFocus={() => { if (article.current) article.current.focus(); else document.getElementById("main-content")?.focus(); }} onKeyDown={event => {
    if (!singleKeys || event.defaultPrevented || event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || isTypingTarget(event.target)) return;
    const action = workspaceAction(event.key, event.repeat);
    if (action === "approve" || action === "reject") { event.preventDefault(); actions[action](); }
  }}>{content}</WorkspaceDialog> : content;
}

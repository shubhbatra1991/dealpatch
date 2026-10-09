"use client";

import { useEffect, useRef, useState } from "react";
import { isUnreviewed, type ReviewChange } from "../../lib/repositories/reviews";
import { displayFieldValue, displayValue, editorOptions, fieldLabel, parseEdit } from "./review-format";

const buttonBase = "inline-flex min-h-8 items-center justify-center rounded-sm border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:border-dashed";
export const reviewButton = `${buttonBase} border-border-strong bg-surface text-text hover:enabled:bg-bg-subtle`;
export const reviewPrimaryButton = `${buttonBase} border-accent bg-accent text-on-accent hover:enabled:bg-accent-hover`;

export function ReviewChangeRow({ item, selected, disabled, onSelect, onSave, readOnly = false }: {
  item: ReviewChange; selected: boolean; disabled: boolean; readOnly?: boolean;
  onSelect: (checked: boolean) => void; onSave: (value: unknown) => Promise<void>;
}) {
  const { change, current, conflict, target } = item;
  const pending = !readOnly && isUnreviewed(change);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const editor = useRef<HTMLTextAreaElement | HTMLSelectElement>(null);
  const restoreEditFocus = useRef(false);
  useEffect(() => {
    if (disabled) return;
    if (editing && error) editor.current?.focus();
    else if (!editing && restoreEditFocus.current) { editButton.current?.focus(); restoreEditFocus.current = false; }
  }, [disabled, editing, error]);
  const options = editorOptions(change);
  const label = `${fieldLabel(change.field)} on ${target}`;
  function close() { restoreEditFocus.current = true; setEditing(false); setError(""); }
  async function save() {
    try { await onSave(parseEdit(draft, change)); close(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save this edit."); }
  }
  return <li data-selected={selected} data-conflict={conflict} className="review-change border-t border-border p-3 sm:px-4">
    <div className="flex items-start gap-3">
      <input aria-label={`Select ${label}`} type="checkbox" checked={selected} disabled={disabled || !pending || conflict} onChange={event => onSelect(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-focus-ring" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="font-semibold text-text">{fieldLabel(change.field)}</span><span className="break-words text-text-muted">{target}</span>{change.status !== "Pending" && <span className="font-medium text-text-muted">{change.status === "Edited" ? "Edited · awaiting approval" : change.status}</span>}{change.edited && change.status !== "Edited" && <span className="text-text-muted">Edited before review</span>}{pending && conflict && <strong className="text-warning">Stale · approval blocked</strong>}</div>
        <div role="group" aria-label={`${label}: current and proposed values`} className="review-diff mt-2 grid gap-1 text-xs sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
          <div className="min-w-0 border-l-2 border-border-strong bg-bg-subtle px-3 py-2"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-text-muted">Current value</span><span className="whitespace-pre-wrap break-words">{displayFieldValue(change.field, current)}</span></div>
          <span aria-hidden="true" className="self-center text-text-subtle">→</span>
          <div className="min-w-0 border-l-2 border-accent bg-accent-soft/50 px-3 py-2"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-accent">Proposed value</span><span className="whitespace-pre-wrap break-words">{displayFieldValue(change.field, change.after)}</span></div>
        </div>
        {pending && conflict && <div className="mt-2 border-l-2 border-warning-border bg-warning-soft px-3 py-2 text-xs text-warning"><p><strong>Original captured value:</strong> <span className="whitespace-pre-wrap break-words">{displayFieldValue(change.field, change.before)}</span></p><p className="mt-1">The current value differs from the generation snapshot, or the target is unavailable. Review all three values and the source again. Editing the proposed value keeps the snapshot and does not resolve staleness. Reject this suggestion or generate a new proposal; newer data will not be overwritten.</p></div>}
        {editing && <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => { if (event.key === "Escape" && !disabled) { event.preventDefault(); close(); } }}>
          <label className="block text-xs font-medium">Edit proposed {fieldLabel(change.field).toLowerCase()}
            {options ? <select ref={element => { editor.current = element; }} autoFocus value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} aria-describedby={error ? `${change.id}-error` : undefined} aria-invalid={!!error} className="mt-1 block min-h-8 w-full rounded-sm border border-border-strong bg-surface px-2">{options.map(value => <option key={value} value={value}>{displayValue(value)}</option>)}</select>
              : <textarea ref={element => { editor.current = element; }} autoFocus rows={2} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} aria-describedby={error ? `${change.id}-error` : undefined} aria-invalid={!!error} className="mt-1 block w-full rounded-sm border border-border-strong bg-surface p-2 font-mono text-xs" />}
          </label>
          <p className="text-xs text-text-muted">Save updates the proposal only. Approval is a separate step.{change.field === "expectedCloseDate" ? " Use YYYY-MM-DD; leave blank to clear." : typeof change.after === "number" ? " Enter a number." : ""}</p>
          {error && <p id={`${change.id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={disabled} className={reviewButton}>Save edit</button><button type="button" disabled={disabled} onClick={close} className={reviewButton}>Cancel</button></div>
        </form>}
      </div>
      {pending && !editing && <button ref={editButton} type="button" disabled={disabled} aria-label={`Edit ${label}`} className={reviewButton} onClick={() => { setDraft(Array.isArray(change.after) ? JSON.stringify(change.after) : String(change.after ?? "")); setEditing(true); }}>Edit</button>}
    </div>
  </li>;
}

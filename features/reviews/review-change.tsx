"use client";

import { useRef, useState } from "react";
import { isUnreviewed, type ReviewChange } from "../../lib/repositories/reviews";
import { displayFieldValue, displayValue, editorOptions, fieldLabel, parseEdit } from "./review-format";

const buttonBase = "inline-flex min-h-8 items-center justify-center rounded-sm border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40";
export const reviewButton = `${buttonBase} border-zinc-300 bg-white text-zinc-700 hover:enabled:bg-zinc-50`;
export const reviewPrimaryButton = `${buttonBase} border-indigo-700 bg-indigo-700 text-white hover:enabled:bg-indigo-800`;

export function ReviewChangeRow({ item, selected, disabled, onSelect, onSave }: {
  item: ReviewChange; selected: boolean; disabled: boolean;
  onSelect: (checked: boolean) => void; onSave: (value: unknown) => Promise<void>;
}) {
  const { change, current, conflict, target } = item;
  const pending = isUnreviewed(change);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const options = editorOptions(change);
  const label = `${fieldLabel(change.field)} on ${target}`;
  function close() { setEditing(false); setError(""); requestAnimationFrame(() => editButton.current?.focus()); }
  async function save() {
    try { await onSave(parseEdit(draft, change)); close(); }
    catch (error) { setError(error instanceof Error ? error.message : "Unable to save this edit."); }
  }
  return <li className="border-t border-zinc-200 p-3 sm:px-4">
    <div className="flex items-start gap-3">
      <input aria-label={`Select ${label}`} type="checkbox" checked={selected} disabled={disabled || !pending || conflict} onChange={event => onSelect(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-indigo-700" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><span className="font-semibold text-zinc-900">{fieldLabel(change.field)}</span><span className="break-words text-zinc-500">{target}</span>{change.status !== "Pending" && <span className="font-medium text-zinc-600">{change.status === "Edited" ? "Edited · awaiting approval" : change.status}</span>}</div>
        <div className="mt-2 grid gap-1 text-xs sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-3">
          <div className="min-w-0 border-l-2 border-zinc-300 bg-zinc-50 px-3 py-2"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-zinc-500">Current value</span><span className="whitespace-pre-wrap break-words">{displayFieldValue(change.field, current)}</span></div>
          <span aria-hidden="true" className="self-center text-zinc-400">→</span>
          <div className="min-w-0 border-l-2 border-indigo-400 bg-indigo-50/50 px-3 py-2"><span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-indigo-700">Proposed value</span><span className="whitespace-pre-wrap break-words">{displayFieldValue(change.field, change.after)}</span></div>
        </div>
        {pending && conflict && <p className="mt-2 text-xs text-amber-900">Conflict: generated against “{displayValue(change.before)}”. The current value has changed or the record is unavailable. Approval is blocked; review the source and reject this proposal if it is stale.</p>}
        {editing && <form className="mt-3 space-y-2" onSubmit={event => { event.preventDefault(); void save(); }} onKeyDown={event => { if (event.key === "Escape" && !disabled) { event.preventDefault(); close(); } }}>
          <label className="block text-xs font-medium">Edit proposed {fieldLabel(change.field).toLowerCase()}
            {options ? <select autoFocus value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} aria-describedby={error ? `${change.id}-error` : undefined} aria-invalid={!!error} className="mt-1 block min-h-8 w-full rounded-sm border border-zinc-300 bg-white px-2">{options.map(value => <option key={value} value={value}>{displayValue(value)}</option>)}</select>
              : <textarea autoFocus rows={2} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} aria-describedby={error ? `${change.id}-error` : undefined} aria-invalid={!!error} className="mt-1 block w-full rounded-sm border border-zinc-300 bg-white p-2 font-mono text-xs" />}
          </label>
          <p className="text-xs text-zinc-500">Save updates the proposal only. Approval is a separate step.{change.field === "expectedCloseDate" ? " Use YYYY-MM-DD; leave blank to clear." : typeof change.after === "number" ? " Enter a number." : ""}</p>
          {error && <p id={`${change.id}-error`} role="alert" className="text-xs text-red-800">{error}</p>}
          <div className="flex gap-2"><button type="submit" disabled={disabled} className={reviewButton}>Save edit</button><button type="button" disabled={disabled} onClick={close} className={reviewButton}>Cancel</button></div>
        </form>}
      </div>
      {pending && !editing && <button ref={editButton} type="button" disabled={disabled} aria-label={`Edit ${label}`} className={reviewButton} onClick={() => { setDraft(Array.isArray(change.after) ? JSON.stringify(change.after) : String(change.after ?? "")); setEditing(true); }}>Edit</button>}
    </div>
  </li>;
}

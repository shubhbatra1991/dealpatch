"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WorkspaceDialog } from "../../components/ui/workspace-dialog";
import { savedViewNameSchema } from "../../domain/saved-views/schema";
import type { PipelineViewConfig, SavedView } from "../../domain/saved-views/saved-view";
import { savedViewMutationOptions } from "./use-saved-views";

type Props = { onClose: () => void; restoreFocus?: () => void } & ({ action: "create"; config: PipelineViewConfig } | { action: "rename" | "delete"; view: SavedView });

export function SavedViewDialog(props: Props) {
  const [name, setName] = useState(props.action === "create" ? "" : props.view.name);
  const [error, setError] = useState<string>();
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { nameInput.current?.focus(); }, []);
  const mutation = useMutation(savedViewMutationOptions(useQueryClient()));
  const title = props.action === "create" ? "Save Pipeline view" : props.action === "rename" ? "Rename saved view" : "Delete saved view";
  function close() { if (!mutation.isPending) props.onClose(); }
  return <WorkspaceDialog title={title} onClose={close} restoreFocus={props.restoreFocus}><form onSubmit={event => {
    event.preventDefault();
    const parsed = savedViewNameSchema.safeParse(name);
    if (props.action !== "delete" && !parsed.success) { setError(parsed.error.issues[0].message); nameInput.current?.focus(); return; }
    setError(undefined);
    const write = props.action === "create" ? { action: "create" as const, name: parsed.data!, config: props.config }
      : props.action === "rename" ? { action: "rename" as const, id: props.view.id, name: parsed.data! }
      : { action: "delete" as const, id: props.view.id };
    mutation.mutate(write, { onSuccess: () => props.onClose(), onError: () => requestAnimationFrame(() => nameInput.current?.focus()) });
  }} className="space-y-3">
    {props.action === "delete" ? <p className="text-xs text-text">Delete “{props.view.name}”? This removes its saved configuration. Deals are unaffected.</p>
      : <label className="flex flex-col gap-1 text-xs font-medium text-text">View name<input ref={nameInput} required maxLength={80} value={name} onChange={event => { setName(event.target.value); setError(undefined); mutation.reset(); }} aria-invalid={Boolean(error || mutation.isError)} aria-describedby={error || mutation.isError ? "saved-view-error" : undefined} disabled={mutation.isPending} className="h-8 rounded-sm border border-border-strong px-2 font-normal" /></label>}
    {(error || mutation.isError) && <p id="saved-view-error" role="alert" className="text-xs text-danger">{error ?? mutation.error?.message}</p>}
    <div className="flex items-center justify-end gap-2"><button type="button" onClick={close} disabled={mutation.isPending} className="h-8 rounded-sm border border-border-strong px-3 text-xs">Cancel</button><button type="submit" disabled={mutation.isPending} className="h-8 rounded-sm bg-accent px-3 text-xs text-on-accent disabled:border-dashed">{mutation.isPending ? "Saving…" : props.action === "delete" ? "Delete view" : "Save view"}</button></div>
  </form></WorkspaceDialog>;
}

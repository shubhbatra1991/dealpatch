"use client";

import { useRef, useState } from "react";
import { useIsMutating, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import type { ApprovalReceipt } from "../../domain/proposals/review";
import { approvalKey, reviewWriteKey, undoMutationOptions, type ApprovalContext } from "./approval-mutations";
import { reviewButton } from "./review-change";

interface Notice {
  id: number;
  status: "idle" | "pending" | "success" | "error";
  error?: string;
  context?: ApprovalContext;
  receipt?: ApprovalReceipt;
}

function ApprovalToast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const undo = useMutation(undoMutationOptions(useQueryClient()));
  const busy = useIsMutating({ mutationKey: reviewWriteKey }) > 0;
  const panel = useRef<HTMLDivElement>(null);
  const saving = notice.status === "pending" || undo.isPending;
  const failure = notice.status === "error" || undo.isError;
  const account = notice.context?.item.account ?? "this proposal";
  async function restore() {
    if (!notice.receipt || !notice.context) return;
    try {
      await undo.mutateAsync({ receipt: notice.receipt, item: notice.context.item, approvalId: notice.id });
      requestAnimationFrame(() => panel.current?.focus());
    } catch { /* Mutation state exposes the failure and leaves Undo available for retry. */ }
  }
  const message = notice.status === "error"
    ? `Approval failed. Previous values and the proposal were restored. ${notice.error ?? "Try again."}`
    : undo.isSuccess ? `Approval undone for ${account}. Original values and proposal restored.`
    : undo.isError ? `Undo failed. No saved changes were made. ${undo.error.message}`
    : undo.isPending ? `Restoring original values for ${account}…`
    : notice.status === "pending" ? `Applying changes for ${account}… Saving locally.`
    : `Approved ${notice.receipt?.changeIds.length ?? 0} changes for ${account}.`;
  return <div ref={panel} tabIndex={-1} className={`rounded-sm border bg-white p-3 shadow-sm ${failure ? "border-red-300" : "border-zinc-300"}`}>
    <p role={failure ? "alert" : "status"} aria-atomic="true" className={`text-xs leading-5 ${failure ? "text-red-900" : "text-zinc-800"}`}>{message}</p>
    <div className="mt-2 flex items-center gap-2">
      {notice.status === "success" && !undo.isSuccess && <button type="button" disabled={busy} onClick={() => void restore()} className={reviewButton}>{undo.isPending ? "Undoing…" : "Undo"}</button>}
      <button type="button" disabled={saving} onClick={onDismiss} className={`${reviewButton} ml-auto`} aria-label={`Dismiss review notification for ${account}`}>Dismiss</button>
    </div>
  </div>;
}

/** Mounted in the shell so feedback and session Undo survive route navigation. */
export function ReviewNotifications() {
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());
  const notices = useMutationState({
    filters: { mutationKey: approvalKey },
    select: (mutation): Notice => ({
      id: mutation.mutationId, status: mutation.state.status,
      error: mutation.state.error?.message,
      context: mutation.state.context as ApprovalContext | undefined,
      receipt: mutation.state.data as ApprovalReceipt | undefined,
    }),
  }).filter(notice => notice.status !== "idle" && !dismissed.has(notice.id));
  if (!notices.length) return null;
  return <section aria-label="Review notifications" className="fixed right-4 bottom-4 z-50 max-h-[65dvh] w-[min(24rem,calc(100vw-2rem))] space-y-2 overflow-y-auto p-1">
    {notices.map(notice => <ApprovalToast key={notice.id} notice={notice} onDismiss={() => {
      setDismissed(current => new Set([...current, notice.id]));
      requestAnimationFrame(() => document.getElementById("main-content")?.focus());
    }} />)}
  </section>;
}

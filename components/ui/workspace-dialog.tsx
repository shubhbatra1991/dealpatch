"use client";

import { useEffect, useRef, type KeyboardEventHandler, type ReactNode } from "react";

// Native modal dialogs provide focus containment and make the background inert.
export function WorkspaceDialog({ title, children, onClose, restoreFocus, onKeyDown }: { title: string; children: ReactNode; onClose: () => void; restoreFocus?: () => void; onKeyDown?: KeyboardEventHandler<HTMLDialogElement> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const restore = useRef(restoreFocus);
  useEffect(() => { restore.current = restoreFocus; }, [restoreFocus]);
  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      queueMicrotask(() => {
        if (element.isConnected && element.open) return; // React Strict Mode reopens the same dialog.
        if (restore.current) restore.current();
        else if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
        else document.getElementById("main-content")?.focus();
      });
    };
  }, []);
  return <dialog ref={dialog} aria-label={title} onKeyDown={event => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(element => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    if (first && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
    }
  }} onCancel={event => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[min(42rem,calc(100%-2rem))] overflow-auto rounded-sm border border-zinc-300 bg-white p-0 text-zinc-900 shadow-lg backdrop:bg-zinc-950/30">
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3"><h2 className="text-sm font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-sm border border-zinc-300 px-2 py-1 text-xs">Close <kbd>Esc</kbd></button></header>
    <div className="p-4">{children}</div>
  </dialog>;
}

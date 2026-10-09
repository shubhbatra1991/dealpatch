"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTypingTarget, workspaceAction, type WorkspaceAction } from "../../lib/utils/keyboard";
import { WorkspaceDialog } from "../ui/workspace-dialog";
import { CommandPalette } from "../../features/search/command-palette";

type Handlers = Partial<Record<WorkspaceAction, () => void>>;
export const WorkspaceKeyboardContext = createContext<{ register: (handlers: Handlers) => () => void; showCommands: () => void; showHelp: () => void; singleKeys: boolean } | null>(null);

export function useWorkspaceKeyboard() {
  const context = useContext(WorkspaceKeyboardContext);
  if (!context) throw new Error("Workspace keyboard provider is missing.");
  return context;
}

export function useWorkspaceShortcuts(handlers: Handlers, enabled = true) {
  const { register } = useWorkspaceKeyboard();
  useEffect(() => enabled ? register(handlers) : undefined, [register, handlers, enabled]);
}

export function WorkspaceKeyboard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    // Let dialog cleanup restore its trigger before focusing the new route.
    const frame = requestAnimationFrame(() => {
      if (!document.querySelector("dialog[open]")) document.getElementById("main-content")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  const handlers = useRef(new Set<Handlers>());
  const [overlay, setOverlay] = useState<"commands" | "help" | null>(null);
  const [singleKeys, setSingleKeys] = useState(true);
  const searchOpener = useRef<HTMLElement | null>(null);
  const showCommands = useCallback(() => {
    searchOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOverlay("commands");
  }, []);
  const register = useCallback((entry: Handlers) => { handlers.current.add(entry); return () => { handlers.current.delete(entry); }; }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        if (overlay === "commands") { event.preventDefault(); if (!event.repeat) setOverlay(null); }
        else if (!isTypingTarget(event.target) && !document.querySelector("dialog[open]")) { event.preventDefault(); if (!event.repeat) showCommands(); }
        return;
      }
      if (isTypingTarget(event.target)) return;
      // Menus own their interactions. Native dialog cancel handles Escape, even in inputs.
      if (document.querySelector("dialog[open], details[open]")) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "?") { event.preventDefault(); if (!event.repeat) setOverlay("help"); return; }
      if (!singleKeys || event.shiftKey) return;
      const action = workspaceAction(event.key, event.repeat);
      if (!action) return;
      if (action === "open" && event.target instanceof HTMLElement && event.target.closest('button, a, summary, input:not([type="checkbox"])')) return;
      // A feature's explicit handler takes precedence over its parent navigation.
      const handler = [...handlers.current].reverse().find(entry => entry[action])?.[action];
      if (handler) { event.preventDefault(); handler(); }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [singleKeys, overlay, showCommands]);
  return <WorkspaceKeyboardContext.Provider value={{ register, singleKeys, showCommands, showHelp: () => setOverlay("help") }}>
    {children}
    {overlay === "commands" && <CommandPalette onClose={() => setOverlay(null)} navigate={path => { setOverlay(null); router.push(path); }} restoreFocus={() => { if (searchOpener.current?.isConnected) searchOpener.current.focus(); else document.getElementById("main-content")?.focus(); }} />}
    {overlay === "help" && <WorkspaceDialog title="Keyboard shortcuts" onClose={() => setOverlay(null)}>
      <p className="mb-3 text-xs text-text-muted">Navigate the current filtered list. A approves the highlighted proposal’s selected, available changes; R rejects its remaining changes. These actions also work inside an opened review. Shortcuts pause while typing, and dialogs pause background navigation.</p>
      <dl className="divide-y divide-border text-sm">{[["Ctrl / ⌘ K", "Search local workspace records"], ["J / K", "Next / previous item"], ["Enter", "Open highlighted item"], ["A", "Approve selected changes"], ["R", "Reject highlighted proposal"], ["Escape", "Close dialog, editor or menu"], ["?", "Keyboard shortcuts"]].map(([key, description]) => <div key={key} className="flex justify-between gap-4 py-2"><dt><kbd>{key}</kbd></dt><dd className="text-right text-text-muted">{description}</dd></div>)}</dl>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={singleKeys} onChange={event => setSingleKeys(event.target.checked)} />Enable single-key list shortcuts</label>
      <p className="mt-2 text-xs text-text-muted">Turn these off for speech input or screen reader character navigation. Standard Tab and arrow-key controls remain available.</p>
    </WorkspaceDialog>}
  </WorkspaceKeyboardContext.Provider>;
}



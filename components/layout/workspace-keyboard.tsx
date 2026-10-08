"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isTypingTarget, workspaceAction, type WorkspaceAction } from "../../lib/utils/keyboard";
import { WorkspaceDialog } from "../ui/workspace-dialog";

type Handlers = Partial<Record<WorkspaceAction, () => void>>;
export const WorkspaceKeyboardContext = createContext<{ register: (handlers: Handlers) => () => void; showCommands: () => void; showHelp: () => void; singleKeys: boolean } | null>(null);
const destinations = [
  ["Overview", "/"], ["Pipeline", "/pipeline"], ["Accounts", "/accounts"],
  ["Contacts", "/contacts"], ["Review Queue", "/reviews"], ["Activity", "/activity"],
] as const;

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
  const handlers = useRef(new Set<Handlers>());
  const [overlay, setOverlay] = useState<"commands" | "help" | null>(null);
  const [singleKeys, setSingleKeys] = useState(true);
  const register = useCallback((entry: Handlers) => { handlers.current.add(entry); return () => { handlers.current.delete(entry); }; }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || isTypingTarget(event.target)) return;
      // Menus own their interactions. Native dialog cancel handles Escape, even in inputs.
      if (document.querySelector("dialog[open], details[open]")) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault(); if (!event.repeat) setOverlay("commands"); return;
      }
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
  }, [singleKeys]);
  return <WorkspaceKeyboardContext.Provider value={{ register, singleKeys, showCommands: () => setOverlay("commands"), showHelp: () => setOverlay("help") }}>
    {children}
    {overlay === "commands" && <CommandMenu onClose={() => setOverlay(null)} navigate={path => { setOverlay(null); router.push(path); }} />}
    {overlay === "help" && <WorkspaceDialog title="Keyboard shortcuts" onClose={() => setOverlay(null)}>
      <p className="mb-3 text-xs text-zinc-600">Navigate the current filtered list. A approves the highlighted proposal’s selected, available changes; R rejects its remaining changes. These actions also work inside an opened review. Shortcuts pause while typing, and dialogs pause background navigation.</p>
      <dl className="divide-y divide-zinc-100 text-sm">{[["Ctrl / ⌘ K", "Search workspace pages"], ["J / K", "Next / previous item"], ["Enter", "Open highlighted item"], ["A", "Approve selected changes"], ["R", "Reject highlighted proposal"], ["Escape", "Close dialog, editor or menu"], ["?", "Keyboard shortcuts"]].map(([key, description]) => <div key={key} className="flex justify-between gap-4 py-2"><dt><kbd>{key}</kbd></dt><dd className="text-right text-zinc-600">{description}</dd></div>)}</dl>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={singleKeys} onChange={event => setSingleKeys(event.target.checked)} />Enable single-key list shortcuts</label>
      <p className="mt-2 text-xs text-zinc-500">Turn these off for speech input or screen reader character navigation. Standard Tab and arrow-key controls remain available.</p>
    </WorkspaceDialog>}
  </WorkspaceKeyboardContext.Provider>;
}

function CommandMenu({ onClose, navigate }: { onClose: () => void; navigate: (path: string) => void }) {
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const results = destinations.filter(([label]) => label.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = Math.min(index, Math.max(0, results.length - 1));
  return <WorkspaceDialog title="Search workspace" onClose={onClose}>
    <input autoFocus type="search" aria-label="Search workspace pages" placeholder="Find a workspace page…" value={search} onChange={event => { setSearch(event.target.value); setIndex(0); }} className="h-9 w-full rounded-sm border border-zinc-300 px-3 text-sm" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setIndex(Math.max(0, Math.min(results.length - 1, selected + (event.key === "ArrowDown" ? 1 : -1)))); }
      if (event.key === "Enter" && results[selected]) { event.preventDefault(); navigate(results[selected][1]); }
    }} />
    <p role="status" className="my-2 text-xs text-zinc-500">{results.length} pages · {results[selected]?.[0] ?? "No selection"} · ↑ ↓ to choose · Enter to open</p>
    <ul aria-label="Workspace pages" className="space-y-1">{results.map(([label, path], resultIndex) => <li key={path}><button type="button" aria-current={resultIndex === selected ? "true" : undefined} onFocus={() => setIndex(resultIndex)} onClick={() => navigate(path)} className={`w-full rounded-sm px-3 py-2 text-left text-sm ${resultIndex === selected ? "bg-indigo-50 text-indigo-900" : "hover:bg-zinc-50"}`}>{label}</button></li>)}</ul>
    {!results.length && <p className="py-4 text-sm text-zinc-600">No matching pages. Try Pipeline or Review Queue.</p>}
  </WorkspaceDialog>;
}

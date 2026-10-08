"use client";

import { useWorkspaceKeyboard } from "./workspace-keyboard";

export function AppHeader() {
  const keyboard = useWorkspaceKeyboard();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 sm:px-6">
      <div className="shrink-0">
        <span className="font-semibold tracking-tight">DealPatch</span>
        <span className="ml-3 hidden text-xs text-zinc-500 md:inline">Sales workspace</span>
      </div>
      <div className="flex w-full max-w-80 items-center gap-2">
        <button type="button" onClick={keyboard.showCommands} aria-keyshortcuts="Control+k Meta+k" aria-haspopup="dialog" className="flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-sm border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-600"><span>Search workspace</span><kbd className="hidden whitespace-nowrap sm:inline">Ctrl / ⌘ K</kbd></button>
        <button type="button" onClick={keyboard.showHelp} aria-label="Keyboard shortcuts" aria-haspopup="dialog" className="h-8 rounded-sm border border-zinc-200 px-2 text-xs">?</button>
      </div>
    </header>
  );
}

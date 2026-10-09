"use client";

import { useWorkspaceKeyboard } from "./workspace-keyboard";
import { usePathname } from "next/navigation";

export function AppHeader() {
  const keyboard = useWorkspaceKeyboard();
  const pathname = usePathname();
  const page = ({ "/": "Overview", "/pipeline": "Pipeline", "/accounts": "Accounts", "/contacts": "Contacts", "/reviews": "Review Queue", "/activity": "Activity" } as Record<string, string>)[pathname] ?? (pathname.startsWith("/accounts/") ? "Accounts" : pathname.startsWith("/contacts/") ? "Contacts" : pathname.startsWith("/deals/") ? "Deal" : "Workspace");
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white px-3 sm:px-5">
      <div className="flex shrink-0 items-center gap-2 text-xs" aria-label={`Sales workspace, ${page}`}>
        <span className="hidden shrink-0 text-zinc-500 md:inline">Sales workspace</span><span aria-hidden="true" className="hidden text-zinc-300 md:inline">/</span>
        <span className="truncate font-medium text-zinc-800">{page}</span>
      </div>
      <div className="flex min-w-0 w-full max-w-72 items-center gap-2">
        <button type="button" onClick={keyboard.showCommands} aria-keyshortcuts="Control+k Meta+k" aria-haspopup="dialog" className="flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-sm border border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-600"><span className="truncate">Search workspace</span><kbd className="hidden whitespace-nowrap text-[10px] text-zinc-500 sm:inline">Ctrl / ⌘ K</kbd></button>
        <button type="button" onClick={keyboard.showHelp} aria-label="Keyboard shortcuts" aria-haspopup="dialog" className="h-8 rounded-sm border border-zinc-200 px-2 text-xs">?</button>
      </div>
    </header>
  );
}

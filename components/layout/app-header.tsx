"use client";

import { useWorkspaceKeyboard } from "./workspace-keyboard";
import { usePathname } from "next/navigation";
import { ThemeControl } from "./theme-control";

export function AppHeader() {
  const keyboard = useWorkspaceKeyboard();
  const pathname = usePathname();
  const page = ({ "/workspace": "Overview", "/workspace/pipeline": "Pipeline", "/workspace/accounts": "Accounts", "/workspace/contacts": "Contacts", "/workspace/reviews": "Review Queue", "/workspace/activity": "Activity" } as Record<string, string>)[pathname] ?? (pathname.startsWith("/workspace/accounts/") ? "Accounts" : pathname.startsWith("/workspace/contacts/") ? "Contacts" : pathname.startsWith("/workspace/deals/") ? "Deal" : "Workspace");
  return (
    <header className="workspace-header flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs" aria-label={`Sales workspace, ${page}`}>
        <span className="hidden shrink-0 text-text-muted lg:inline">Sales workspace</span><span aria-hidden="true" className="hidden text-text-subtle lg:inline">/</span>
        <span className="truncate font-medium text-text">{page}</span>
      </div>
      <div className="flex w-auto shrink-0 max-w-[30rem] items-center gap-2 sm:w-full sm:shrink">
        <ThemeControl />
        <button type="button" onClick={keyboard.showCommands} aria-label="Search workspace" title="Search workspace" aria-keyshortcuts="Control+k Meta+k" aria-haspopup="dialog" className="workspace-search flex h-8 min-w-8 shrink-0 items-center justify-between gap-2 rounded-sm border border-border bg-bg-subtle px-2 text-xs text-text-muted sm:min-w-0 sm:flex-1 sm:px-2.5"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-3.5 shrink-0"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg><span className="hidden truncate sm:inline">Search workspace</span><kbd className="hidden whitespace-nowrap text-[10px] text-text-muted lg:inline">Ctrl / ⌘ K</kbd></button>
        <button type="button" onClick={keyboard.showHelp} aria-label="Keyboard shortcuts" aria-haspopup="dialog" className="h-8 rounded-sm border border-border px-2 text-xs">?</button>
      </div>
    </header>
  );
}

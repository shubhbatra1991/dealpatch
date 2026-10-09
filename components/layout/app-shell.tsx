import type { ReactNode } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { WorkspaceInitializer } from "./workspace-initializer";
import { ReviewNotifications } from "../../features/reviews/review-notifications";
import { WorkspaceKeyboard } from "./workspace-keyboard";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceKeyboard><div className="flex h-dvh min-h-0 overflow-hidden text-sm">
      <a href="#main-content" className="fixed top-3 left-3 z-50 -translate-y-24 rounded-sm bg-surface px-3 py-2 shadow-sm focus:translate-y-0">
        Skip to content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main id="main-content" tabIndex={-1} className="workspace-main min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          <WorkspaceInitializer>{children}</WorkspaceInitializer>
        </main>
      </div>
      <ReviewNotifications />
    </div></WorkspaceKeyboard>
  );
}

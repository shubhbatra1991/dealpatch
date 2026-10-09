"use client";

import type { ReactNode } from "react";
import { useWorkspaceInitialization } from "@/hooks/use-workspace-initialization";

export function WorkspaceInitializer({ children }: { children: ReactNode }) {
  const { status, retry } = useWorkspaceInitialization();

  if (status === "loading") {
    return <p role="status" className="text-sm text-text-muted">Opening local workspace…</p>;
  }
  if (status === "error") {
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>Unable to open the local workspace. Check that browser storage is available, then retry.</p>
        <button type="button" onClick={retry} className="rounded-sm border border-border-strong px-3 py-1.5 hover:bg-bg-subtle">Retry</button>
      </div>
    );
  }
  return children;
}

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/lib/query/provider";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <QueryProvider><AppShell>{children}</AppShell></QueryProvider>;
}

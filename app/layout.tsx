import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/lib/query/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DealPatch", template: "%s · DealPatch" },
  description: "A local B2B sales workspace for human-reviewed automation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full">
        <QueryProvider><AppShell>{children}</AppShell></QueryProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DealPatch", template: "%s · DealPatch" },
  description: "An open-source, local-first B2B sales workspace exploring transparent, human-reviewed CRM automation.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Synchronous first-party script prevents a storage/time-dependent theme flash. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="h-full">
        {children}
      </body>
    </html>
  );
}

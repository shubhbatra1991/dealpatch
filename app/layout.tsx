import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DealPatch", template: "%s · DealPatch" },
  description: "An open-source, local-first B2B sales workspace exploring transparent, human-reviewed CRM automation.",
  icons: {
    icon: [
      { url: "/brand/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/dealpatch-logo-192.png", type: "image/png", sizes: "192x192" },
      { url: "/brand/dealpatch-logo-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
  },
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

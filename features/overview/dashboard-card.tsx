import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardCard({ id, title, eyebrow, href, linkLabel, children }: {
  id: string; title: string; eyebrow?: string; href?: string; linkLabel?: string; children: ReactNode;
}) {
  return <section aria-labelledby={id} data-panel={id} className="workspace-panel dashboard-panel min-w-0 rounded-sm border border-border bg-surface">
    <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
      <div>{eyebrow && <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">{eyebrow}</p>}<h2 id={id} className="text-xs font-semibold text-text">{title}</h2></div>
      {href && <Link href={href} className="shrink-0 rounded-sm text-[11px] font-medium text-accent underline-offset-4 hover:underline">{linkLabel ?? "View all"}<span aria-hidden="true"> ↗</span></Link>}
    </header>
    {children}
  </section>;
}

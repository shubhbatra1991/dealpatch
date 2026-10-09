import Link from "next/link";
import type { ReactNode } from "react";

export function DashboardCard({ id, title, eyebrow, href, linkLabel, children }: {
  id: string; title: string; eyebrow?: string; href?: string; linkLabel?: string; children: ReactNode;
}) {
  return <section aria-labelledby={id} className="min-w-0 rounded-sm border border-zinc-200 bg-white">
    <header className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5">
      <div>{eyebrow && <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{eyebrow}</p>}<h2 id={id} className="text-xs font-semibold text-zinc-900">{title}</h2></div>
      {href && <Link href={href} className="shrink-0 rounded-sm text-[11px] font-medium text-indigo-700 underline-offset-4 hover:underline">{linkLabel ?? "View all"}<span aria-hidden="true"> ↗</span></Link>}
    </header>
    {children}
  </section>;
}

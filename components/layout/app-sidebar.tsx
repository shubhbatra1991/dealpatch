"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePendingProposals } from "../../features/reviews/use-pending-proposals";
import { FavoritesSection } from "../../features/favorites/favorites-section";
import { SavedViewsSection } from "../../features/saved-views/saved-views-section";

const navigation = [
  { href: "/", label: "Overview", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
  { href: "/pipeline", label: "Pipeline", icon: "M4 4v16 M12 4v16 M20 4v16 M4 8h4 M12 12h4 M20 16h1" },
  { href: "/accounts", label: "Accounts", icon: "M4 21V7h16v14 M8 7V3h8v4 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M10 21v-3h4v3" },
  { href: "/contacts", label: "Contacts", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M17 11h6" },
  { href: "/reviews", label: "Review Queue", icon: "M9 3H5v18h14V3h-4 M9 2h6v4H9z M8 13l3 3 5-6" },
  { href: "/activity", label: "Activity", icon: "M2 12h5l3-8 4 16 3-8h5" },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const pending = usePendingProposals();
  const groups = [
    { label: "Workspace", items: navigation.filter(item => item.href === "/") },
    { label: "Workflow", items: navigation.filter(item => ["/pipeline", "/reviews", "/activity"].includes(item.href)) },
    { label: "Relationships", items: navigation.filter(item => ["/accounts", "/contacts"].includes(item.href)) },
  ];

  return (
    <aside className="flex w-14 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 sm:w-48">
      <div className="flex h-12 shrink-0 items-center justify-center border-b border-zinc-200 px-3 sm:justify-start sm:gap-2.5">
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-zinc-900 text-xs font-bold text-white">DP</span>
        <div className="hidden min-w-0 sm:block"><p className="text-xs font-semibold text-zinc-900">DealPatch</p><p className="mt-0.5 text-[10px] text-zinc-500">Demo workspace</p></div>
      </div>
      <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-3">
        {groups.map(group => <div key={group.label}>
        <p className="sr-only mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 sm:not-sr-only">{group.label}</p>
        <ul aria-label={group.label} className="space-y-0.5">
          {group.items.map(({ href, label, icon }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`) || href === "/pipeline" && pathname.startsWith("/deals/");
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} title={label} className={`relative flex h-8 items-center justify-center gap-2.5 rounded-sm px-2 text-xs sm:justify-start ${active ? "bg-white font-semibold text-zinc-950 ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-950"}`}>
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0"><path d={icon} /></svg>
                  <span className="sr-only sm:not-sr-only">{label}</span>
                  {href === "/reviews" && (
                    <span className="absolute top-0.5 right-0.5 rounded-sm bg-zinc-200 px-1 text-[10px] leading-4 text-zinc-700 tabular-nums sm:static sm:ml-auto sm:px-1.5 sm:text-xs sm:leading-5">
                      <span aria-hidden="true">{pending.data?.length ?? "—"}</span>
                      <span className="sr-only">{pending.data ? `${pending.data.length} pending` : "Pending count unavailable"}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul></div>)}
        <FavoritesSection />
        <SavedViewsSection />
      </nav>
      <div className="hidden border-t border-zinc-200 px-4 py-3 sm:block"><p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600"><span aria-hidden="true" className="size-1.5 rounded-full bg-zinc-400" />Local workspace</p><p className="mt-1 text-[10px] text-zinc-500">Fictional data · Human-reviewed</p></div>
    </aside>
  );
}

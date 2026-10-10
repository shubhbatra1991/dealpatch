"use client";

import Link from "next/link";
import { FiActivity, FiBriefcase, FiCheckSquare, FiColumns, FiGrid, FiUsers } from "react-icons/fi";
import { usePathname } from "next/navigation";
import { usePendingProposals } from "../../features/reviews/use-pending-proposals";
import { FavoritesSection } from "../../features/favorites/favorites-section";
import { SavedViewsSection } from "../../features/saved-views/saved-views-section";

const navigation = [
  { href: "/workspace", label: "Overview", icon: FiGrid },
  { href: "/workspace/pipeline", label: "Pipeline", icon: FiColumns },
  { href: "/workspace/accounts", label: "Accounts", icon: FiBriefcase },
  { href: "/workspace/contacts", label: "Contacts", icon: FiUsers },
  { href: "/workspace/reviews", label: "Review Queue", icon: FiCheckSquare },
  { href: "/workspace/activity", label: "Activity", icon: FiActivity },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const pending = usePendingProposals();
  const groups = [
    { label: "Workspace", items: navigation.filter(item => item.href === "/workspace") },
    { label: "Workflow", items: navigation.filter(item => ["/workspace/pipeline", "/workspace/reviews", "/workspace/activity"].includes(item.href)) },
    { label: "Relationships", items: navigation.filter(item => ["/workspace/accounts", "/workspace/contacts"].includes(item.href)) },
  ];

  return (
    <aside className="workspace-sidebar flex w-14 shrink-0 flex-col border-r border-border bg-bg-subtle sm:w-48">
      <div className="flex h-12 shrink-0 items-center justify-center border-b border-border px-3 sm:justify-start sm:gap-2.5">
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent text-xs font-bold text-on-accent">DP</span>
        <div className="hidden min-w-0 sm:block"><p className="text-xs font-semibold text-text">DealPatch</p><p className="mt-0.5 text-[10px] text-text-muted">Demo workspace</p></div>
      </div>
      <nav aria-label="Main navigation" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-3">
        {groups.map(group => <div key={group.label}>
        <p className="sr-only mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted sm:not-sr-only">{group.label}</p>
        <ul aria-label={group.label} className="space-y-0.5">
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = href === "/workspace" ? pathname === "/workspace" : pathname === href || pathname.startsWith(`${href}/`) || href === "/workspace/pipeline" && pathname.startsWith("/workspace/deals/");
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} title={label} className={`workspace-nav-link relative flex h-8 items-center justify-center gap-2.5 rounded-sm px-2 text-xs sm:justify-start ${active ? "bg-accent-soft font-semibold text-text" : "text-text-muted hover:bg-surface-muted/50 hover:text-text"}`}>
                  <Icon aria-hidden="true" strokeWidth={1.5} className="size-4 shrink-0" />
                  <span className="sr-only sm:not-sr-only">{label}</span>
                  {href === "/workspace/reviews" && (
                    <span className="absolute top-0.5 right-0.5 rounded-sm bg-surface-muted px-1 text-[10px] leading-4 text-text tabular-nums sm:static sm:ml-auto sm:px-1.5 sm:text-xs sm:leading-5">
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
      <div className="hidden border-t border-border px-4 py-3 sm:block"><p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted"><span aria-hidden="true" className="size-1.5 rounded-full bg-surface-muted" />Local workspace</p><p className="mt-1 text-[10px] text-text-muted">Fictional data · Human-reviewed</p></div>
    </aside>
  );
}

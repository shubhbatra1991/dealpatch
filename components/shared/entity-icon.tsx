const paths = {
  account: "M4 21V7h16v14 M8 7V3h8v4 M8 11h1 M15 11h1 M8 15h1 M15 15h1 M10 21v-3h4v3",
  contact: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v6 M17 11h6",
  deal: "M4 4v16 M12 4v16 M20 4v16 M4 8h4 M12 12h4 M20 16h1",
  review: "M9 3H5v18h14V3h-4 M9 2h6v4H9z M8 13l3 3 5-6",
  activity: "M2 12h5l3-8 4 16 3-8h5",
  view: "M4 5h16 M4 12h16 M4 19h16 M8 3v4 M16 10v4 M10 17v4",
} as const;

/** Decorative only; the adjacent record name/type supplies the accessible name. */
export function EntityIcon({ type, className = "size-4 shrink-0" }: { type: keyof typeof paths; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={paths[type]} /></svg>;
}

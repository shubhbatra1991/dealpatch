import { FiActivity, FiBriefcase, FiCheckSquare, FiColumns, FiSliders, FiUsers } from "react-icons/fi";

const icons = { account: FiBriefcase, contact: FiUsers, deal: FiColumns, review: FiCheckSquare, activity: FiActivity, view: FiSliders } as const;

/** Decorative only; the adjacent record name/type supplies the accessible name. */
export function EntityIcon({ type, className = "size-4 shrink-0" }: { type: keyof typeof icons; className?: string }) {
  const Icon = icons[type];
  return <Icon aria-hidden="true" strokeWidth={1.5} className={className} />;
}

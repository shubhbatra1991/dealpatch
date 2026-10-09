/** Shared local-read feedback for the two account surfaces. */
export function AccountQueryState({ failed, ready, fetching, retry }: { failed: boolean; ready: boolean; fetching: boolean; retry: () => void }) {
  if (failed) return <div role="alert" className="workspace-state flex flex-wrap items-center gap-3 rounded-sm border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger"><p>{ready ? "Unable to refresh account data. Showing the last loaded values." : "Unable to load account data from local storage."}</p><button type="button" onClick={retry} disabled={fetching} className="rounded-sm font-medium underline underline-offset-4 disabled:border-dashed">Retry</button></div>;
  if (!ready) return <p role="status" aria-busy="true" className="workspace-state rounded-sm border border-border p-4 text-xs text-text-muted">Loading account data…</p>;
  return null;
}

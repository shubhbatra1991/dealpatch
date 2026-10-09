export function ContactsQueryState({ failed, ready, fetching, retry }: { failed: boolean; ready: boolean; fetching: boolean; retry: () => void }) {
  if (failed) return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"><p>{ready ? "Unable to refresh contact data. Showing the last loaded values." : "Unable to load contact data from local storage."}</p><button type="button" onClick={retry} disabled={fetching} className="rounded-sm font-medium underline underline-offset-4 disabled:opacity-50">Retry</button></div>;
  if (!ready) return <p role="status" aria-busy="true" className="rounded-sm border border-zinc-200 p-4 text-xs text-zinc-500">Loading contact data…</p>;
  return null;
}

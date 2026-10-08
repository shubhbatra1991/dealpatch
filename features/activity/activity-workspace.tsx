"use client";

import { useState } from "react";
import { useAccounts } from "../accounts/use-accounts";
import { useDeals } from "../pipeline/use-deals";
import { displayTimestamp } from "../reviews/review-format";
import { reviewButton } from "../reviews/review-change";
import { useActivities } from "./use-activities";
import { useDemoAnalysis } from "./use-demo-analysis";
import { AgentPanel } from "./agent-panel";
import { useWorkspaceShortcuts } from "../../components/layout/workspace-keyboard";

export function ActivityWorkspace() {
  const activities = useActivities();
  const accounts = useAccounts();
  const deals = useDeals();
  const analysis = useDemoAnalysis();
  const [selectedId, setSelectedId] = useState("");
  const activity = activities.data?.find(activity => activity.id === selectedId) ?? activities.data?.[0];
  const ready = activities.data !== undefined && accounts.data !== undefined && deals.data !== undefined;
  const failed = activities.isError || accounts.isError || deals.isError;
  const account = accounts.data?.find(account => account.id === activity?.accountId);
  const deal = deals.data?.find(deal => deal.id === activity?.dealId && deal.accountId === activity?.accountId);
  const running = analysis.state.status === "running";
  const queueing = analysis.queue.isPending;
  function moveActivity(direction: number) {
    const items = activities.data ?? [];
    if (queueing || !items.length) return;
    const current = items.findIndex(item => item.id === activity?.id);
    const next = items[Math.max(0, Math.min(items.length - 1, current + direction))];
    analysis.reset(); setSelectedId(next.id);
  }
  useWorkspaceShortcuts({ next: () => moveActivity(1), previous: () => moveActivity(-1), open: () => document.getElementById("activity-detail")?.focus() });
  function retry() { void activities.refetch(); void accounts.refetch(); void deals.refetch(); }
  return <section aria-labelledby="activity-title" className="space-y-4">
    <header className="border-b border-zinc-200 pb-3"><h1 id="activity-title" className="text-lg font-semibold tracking-tight">Activity</h1><p className="mt-1 text-sm text-zinc-600">Inspect a source activity and watch simulated analysis build a review suggestion.</p></header>
    {failed && <div role="alert" className="flex flex-wrap items-center gap-3 border border-red-200 bg-red-50 p-3 text-sm text-red-900"><p>Unable to {ready ? "refresh" : "load"} local activity data.{ready ? " Showing the last loaded records." : ""}</p><button type="button" onClick={retry} disabled={activities.isFetching || accounts.isFetching || deals.isFetching} className="underline underline-offset-4">Retry</button></div>}
    {!ready && !failed && <p role="status" aria-busy="true" className="p-3 text-sm text-zinc-500">Loading local activities…</p>}
    {ready && !activity && <p className="border border-zinc-200 p-4 text-sm text-zinc-500">No activities yet. Add demo activities to analyze their source text.</p>}
    {ready && activity && <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="source-title" className="min-w-0 rounded-sm border border-zinc-200">
        <div className="border-b border-zinc-200 bg-zinc-50/70 p-3 sm:p-4"><h2 id="source-title" className="text-sm font-semibold">Source activity</h2><p className="mt-1 text-xs text-zinc-500">{activities.data!.length} fictional activities · Newest first</p></div>
        <div className="space-y-4 p-3 sm:p-4">
          <label className="block text-xs font-medium text-zinc-600">Choose activity<select disabled={queueing} value={activity.id} onChange={event => { analysis.reset(); setSelectedId(event.target.value); }} className="mt-1 block h-9 w-full min-w-0 truncate rounded-sm border border-zinc-300 bg-white px-2 text-xs text-zinc-700">{activities.data!.map(activity => <option key={activity.id} value={activity.id}>{activity.type} · {activity.title} · {activity.occurredAt.slice(0, 10)}</option>)}</select></label>
          <div id="activity-detail" tabIndex={-1}><h3 className="break-words text-sm font-semibold">{activity.title}</h3><p className="mt-1 text-xs text-zinc-500">{activity.type} · <time dateTime={activity.occurredAt}>{displayTimestamp(activity.occurredAt)}</time></p></div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs"><dt className="text-zinc-500">Account</dt><dd className="break-words text-zinc-700">{account?.name ?? "Unmatched account"}</dd><dt className="text-zinc-500">Deal</dt><dd className="break-words text-zinc-700">{deal?.title ?? "No linked deal"}</dd><dt className="text-zinc-500">Participants</dt><dd className="break-words font-mono text-[11px] text-zinc-600">{activity.participants?.join(", ") || "None linked"}</dd></dl>
          <div className="border-y border-zinc-200 py-3"><h3 className="text-xs font-medium text-zinc-600">Activity text</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">{activity.summary}</p></div>
          <button id="run-analysis" type="button" disabled={running || queueing} onClick={() => void analysis.start({ activity, accounts: accounts.data!, deals: deals.data! })} className={reviewButton}>{running ? "Analyzing…" : analysis.state.status === "idle" ? "Run simulated analysis" : "Run again"}</button>
          <p className="text-xs leading-5 text-zinc-500">Analysis reads local data only. Switching activities cancels the current run. Generated suggestions require an explicit send and human approval.</p>
        </div>
      </section>
      <AgentPanel analysis={analysis} />
    </div>}
  </section>;
}

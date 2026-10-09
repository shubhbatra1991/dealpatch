"use client";

import { useMemo, useState } from "react";
import { generateDemoDeals } from "../../lib/simulation/generate-demo-deals";
import { useAccounts } from "../accounts/use-accounts";
import { useDeals } from "./use-deals";
import { PipelineTable } from "./pipeline-table";
import Link from "next/link";
import type { PipelineViewConfig } from "../../domain/saved-views/saved-view";
import { useSavedViews } from "../saved-views/use-saved-views";
import { SavedViewDialog } from "../saved-views/saved-view-dialog";

export function PipelineWorkspace({ targetDealId, savedViewId }: { targetDealId?: string; savedViewId?: string }) {
  const deals = useDeals();
  const accounts = useAccounts();
  const views = useSavedViews();
  const view = views.data?.find(record => record.id === savedViewId);
  const [saving, setSaving] = useState<PipelineViewConfig>();
  const [performanceCount, setPerformanceCount] = useState(0);
  const displayedDeals = useMemo(() => performanceCount > 0 && accounts.data?.length
    ? generateDemoDeals(accounts.data, performanceCount) : deals.data,
  [performanceCount, accounts.data, deals.data]);
  const failed = deals.isError || accounts.isError;
  const ready = deals.data !== undefined && accounts.data !== undefined;
  function retry() { void deals.refetch(); void accounts.refetch(); }

  return (
    <section aria-labelledby="pipeline-title" className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex min-h-14 items-start justify-between gap-4 border-b border-zinc-200 pb-3">
        <div><h1 id="pipeline-title" className="text-lg font-semibold tracking-tight">Pipeline</h1><p className="mt-1 text-sm text-zinc-600">Review opportunities, priorities and next steps.</p></div>
        <span role="status" className="pt-1 text-xs text-zinc-500">{ready && (deals.isFetching || accounts.isFetching) ? "Updating…" : "Local workspace"}</span>
      </div>
      {process.env.NODE_ENV === "development" && ready && accounts.data.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <label className="flex items-center gap-2">Performance dataset
          <select value={performanceCount} onChange={(event) => setPerformanceCount(Number(event.target.value))} className="h-7 rounded-sm border border-zinc-300 bg-white px-2 text-zinc-700">
            <option value={0}>Saved workspace</option>
            <option value={1000}>1,000 fictional deals</option>
            <option value={10000}>10,000 fictional deals</option>
            <option value={50000}>50,000 fictional deals</option>
          </select>
        </label>
        {performanceCount > 0 && <span role="status">Temporary view · Nothing is saved</span>}
      </div>}
      {failed && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        <p>{ready ? "Unable to refresh the pipeline. Showing the last loaded data." : "Unable to load the pipeline from local storage."}</p>
        <button type="button" onClick={retry} disabled={deals.isFetching || accounts.isFetching} className="font-medium underline underline-offset-4 disabled:opacity-50">Retry</button>
      </div>}
      {ready && targetDealId && !deals.data.some(deal => deal.id === targetDealId) && <p role="status" className="text-xs text-amber-800">The selected deal is no longer in this workspace. Showing the saved pipeline.</p>}
      {view && <p className="text-xs text-zinc-600">Saved view: <span className="font-medium text-zinc-800">{view.name}</span> · <Link href="/pipeline" className="rounded-sm underline">Default pipeline</Link></p>}
      {savedViewId && views.isError && <p role="alert" className="text-xs text-red-900">Unable to load this saved view. <button type="button" onClick={() => void views.refetch()} className="underline">Retry</button> · <Link href="/pipeline" className="underline">Default pipeline</Link></p>}
      {savedViewId && !views.isError && views.data && !view && <p role="status" className="text-xs text-amber-800">This saved view is no longer available. Showing the default pipeline. <Link href="/pipeline" className="underline">Clear saved view</Link></p>}
      {ready && displayedDeals && (!savedViewId || views.data && !views.isError) ? <PipelineTable key={`${performanceCount}:${view?.id ?? "default"}`} deals={displayedDeals} accounts={accounts.data} initialView={view} onSaveView={setSaving} initialDealId={performanceCount === 0 ? targetDealId : undefined} /> : !failed && !(savedViewId && views.isError) && <div role="status" aria-busy="true" className="rounded-sm border border-zinc-200 p-4 text-sm text-zinc-500">{savedViewId && !views.data ? "Loading saved view…" : "Loading pipeline…"}</div>}
      {saving && <SavedViewDialog action="create" config={saving} onClose={() => setSaving(undefined)} />}
    </section>
  );
}


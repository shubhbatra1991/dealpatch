"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { isProposalChangeStale } from "../../domain/proposals/review";
import type { ActivityRow } from "./activity-model";
import type { IntelligenceEvent } from "../../lib/simulation/intelligence-provider";
import { displayFieldValue, fieldLabel } from "../reviews/review-format";
import { reviewButton, reviewPrimaryButton } from "../reviews/review-change";
import type { useDemoAnalysis } from "./use-demo-analysis";

export const analysisSteps = [
  ["activity_received", "Receive activity"], ["extracting_entities", "Extract linked entities"],
  ["matching_account", "Match account"], ["matching_deal", "Match deal"],
  ["detecting_changes", "Detect field changes"], ["evaluating_confidence", "Evaluate demo confidence"],
  ["proposal_generated", "Generate review proposal"],
] as const;

function eventDetail(event: IntelligenceEvent): string {
  switch (event.type) {
    case "activity_received": return `Received ${event.activityId}. No external service contacted.`;
    case "extracting_entities": return `${event.participantIds.length} linked ${event.participantIds.length === 1 ? "participant" : "participants"} · ${event.signals.length} supported phrase ${event.signals.length === 1 ? "match" : "matches"}${event.signals.length ? `: ${event.signals.join(", ")}` : ""}.`;
    case "matching_account": return event.account ? `Linked account: ${event.account.name}. Matched by the activity's account ID.` : "No linked account found.";
    case "matching_deal": return event.deal ? `Linked deal: ${event.deal.title}. Matched by the activity's deal ID.` : "No deal linked to this activity and account.";
    case "detecting_changes": return `${event.changes.length} proposed field changes. Current values have not been updated.`;
    case "evaluating_confidence": return `${event.confidence}% simulated confidence. ${event.basis}`;
    case "proposal_generated": return `Draft proposal ready · ${event.proposal.changes.length} changes require human review.`;
    case "analysis_completed": return event.reason;
  }
}

export function AgentPanel({ analysis, row }: { analysis: ReturnType<typeof useDemoAnalysis>; row?: ActivityRow }) {
  const { state, proposal, queue } = analysis;
  const queueLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (queue.isSuccess) queueLink.current?.focus(); }, [queue.isSuccess]);
  const existing = analysis.existingProposal ?? queue.data?.proposal;
  const running = state.status === "running";
  const detected = state.events.find(event => event.type === "detecting_changes");
  const changes = detected?.type === "detecting_changes" ? detected.changes : [];
  const latest = state.events.at(-1);
  const progress = running ? `Running · ${analysisSteps[Math.min(state.events.length, 6)][1]}` : state.status === "completed" ? "Complete · Analysis complete" : state.status === "cancelled" ? "Analysis cancelled" : state.status === "error" ? "Failed · Analysis failed" : "Waiting · Ready to analyze";
  return <section aria-labelledby="agent-title" className="workspace-panel analysis-panel min-w-0 rounded-sm border border-border bg-surface">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-bg-subtle/70 p-3 sm:p-4">
      <div><h2 id="agent-title" className="text-sm font-semibold">Demo intelligence</h2><p className="mt-1 text-xs leading-5 text-text-muted">Local deterministic rules with staged events. No real LLM or external AI API.</p></div>
      {running && <button type="button" onClick={() => { analysis.cancel(); requestAnimationFrame(() => document.getElementById("run-analysis")?.focus()); }} className={reviewButton}>Cancel analysis</button>}
    </header>
    <div className="border-b border-border px-3 py-2 sm:px-4">
      <p className="text-xs font-medium text-text">{progress}{running ? ` · ${state.events.length} of 7 events received` : ""}</p>
      <p role="status" aria-atomic="true" className="sr-only">{running ? "Simulated analysis started." : state.status === "completed" ? "Simulated analysis completed. Review the result below; CRM changes have not been applied." : state.status === "cancelled" ? "Simulated analysis cancelled. No proposal was saved." : ""}</p>
      {state.status === "cancelled" && <p className="mt-1 text-xs text-text-muted">Partial results retained. No proposal was saved. Run again to restart.</p>}
      {state.status === "error" && <p role="alert" className="mt-1 text-xs text-danger">{state.error} No proposal was saved. You can retry the analysis.</p>}
    </div>
    {analysis.checkingSource && <div className="border-b border-border p-3 text-xs text-text-muted">{analysis.proposals.isError ? <><p role="alert">Unable to check existing reviews. Retry before running analysis.</p><button type="button" className={reviewButton} onClick={() => void analysis.proposals.refetch()}>Retry review lookup</button></> : <p role="status">Checking source review history…</p>}</div>}
    {existing && <div className="border-b border-border p-3 text-xs"><p role="status" className="mb-2 font-medium">Already in Review Queue</p><p className="mb-2 text-text-muted">{existing.status} · This activity already has a review proposal.</p><Link ref={queueLink} href={`/reviews?proposal=${encodeURIComponent(existing.id)}`} className={reviewButton}>Open Review</Link>{queue.isSuccess && <p role="status" className="mt-2 text-text-muted">{queue.data.created ? "Proposal saved for human review." : "An existing proposal was found. No duplicate was created."}</p>}</div>}
    <ol aria-label="Simulated analysis events" className="divide-y divide-border">
      {analysisSteps.map(([type, label], index) => {
        const event = state.events.find(event => event.type === type || index === 6 && event.type === "analysis_completed");
        const active = running && index === state.events.length;
        const failed = state.status === "error" && index === state.events.length;
        return <li key={type} aria-current={active ? "step" : undefined} className={`flex gap-3 px-3 py-3 sm:px-4 ${active ? "bg-accent-soft/40" : failed ? "bg-danger-soft/40" : ""}`}>
          <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px] ${event ? "border-border-strong text-text" : active ? "border-accent font-bold text-accent" : "border-border text-text-muted"}`}>{event ? "✓" : failed ? "!" : index + 1}</span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className={`text-xs font-medium ${event || active ? "text-text" : "text-text-muted"}`}>{event?.type === "analysis_completed" ? "Complete without a proposal" : label}</h3><span className="text-[10px] text-text-muted">{event ? "Complete" : active ? "Running" : failed ? "Failed" : "Waiting"}</span></div>
            {failed && <p className="mt-1 text-xs text-danger">{state.error}</p>}
            {event && <><p className="mt-1 break-words text-xs leading-5 text-text-muted">{eventDetail(event)}</p><p className="mt-1 text-[10px] text-text-muted"><code>{event.type}</code> · event {event.sequence}</p></>}
          </div>
        </li>;
      })}
    </ol>
    {changes.length > 0 && <div className="border-t border-border p-3 sm:p-4">
      <h3 className="text-xs font-semibold">{proposal ? "Generated proposal" : "Detected changes · preliminary"}</h3>
      {proposal && row && <p className="mt-2 text-xs text-text-muted">{row.account ? <Link className="underline" href={`/accounts/${encodeURIComponent(row.account.id)}`}>{row.account.name}</Link> : "Unavailable account"}{row.deal && <> · <Link className="underline" href={`/deals/${encodeURIComponent(row.deal.id)}`}>{row.deal.title}</Link></>}</p>}
      <dl className="mt-2 space-y-2">{changes.map(change => {
        const current: unknown = row?.deal && change.entityId === row.deal.id ? Reflect.get(row.deal, change.field) ?? null : change.before;
        const stale = isProposalChangeStale(change, current);
        return <div key={change.id} className="border-l-2 border-accent bg-accent-soft/30 px-3 py-2 text-xs"><dt className="font-medium text-text">{fieldLabel(change.field)}</dt><dd className="mt-1 break-words text-text-muted"><span className="sr-only">Current value: </span>{displayFieldValue(change.field, current)}<span aria-hidden="true" className="mx-2">→</span><span className="sr-only"> Proposed value: </span>{displayFieldValue(change.field, change.after)}</dd>{stale && <dd><details className="mt-2 text-warning"><summary>Current value changed since capture</summary><p className="mt-1">Original captured value: {displayFieldValue(change.field, change.before)}. Run analysis again before sending.</p></details></dd>}</div>; })}</dl>
      {proposal && <>
        <p className="mt-2 text-xs font-medium text-text">{proposal.changes.length} proposed field changes · {proposal.confidence}% demo confidence</p>
        <h4 className="mt-3 text-xs font-semibold text-text">Source evidence</h4>{proposal.evidence.map((evidence, index) => <blockquote key={index} className="mt-2 border-l-2 border-border-strong pl-3 text-xs leading-5 text-text-muted">{evidence.text}</blockquote>)}
        <p className="mt-3 text-xs text-text-muted">{existing ? "Saved for human review. CRM values are unchanged." : "Pending suggestion · Nothing is applied to your CRM. Send it to the queue for human review."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={analysis.reviewBusy || queue.isSuccess || analysis.checkingSource || Boolean(existing)} className={reviewPrimaryButton} onClick={() => queue.mutate(proposal)}>{queue.isPending ? "Sending…" : existing ? "In Review Queue" : "Send to Review Queue"}</button>
        </div>
        {queue.isError && <p role="alert" className="mt-2 text-xs text-danger">Unable to queue this proposal: {queue.error.message}</p>}
      </>}
      {state.status === "cancelled" && <p className="mt-3 text-xs text-text-muted">Preliminary changes are not a completed proposal and cannot be queued.</p>}
    </div>}
    {latest?.type === "analysis_completed" && <p className="border-t border-border p-3 text-xs leading-5 text-text-muted sm:px-4">{latest.reason}</p>}
  </section>;
}

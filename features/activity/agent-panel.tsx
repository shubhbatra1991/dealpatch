"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
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

export function AgentPanel({ analysis }: { analysis: ReturnType<typeof useDemoAnalysis> }) {
  const { state, proposal, queue } = analysis;
  const queueLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => { if (queue.isSuccess) queueLink.current?.focus(); }, [queue.isSuccess]);
  const running = state.status === "running";
  const detected = state.events.find(event => event.type === "detecting_changes");
  const changes = detected?.type === "detecting_changes" ? detected.changes : [];
  const latest = state.events.at(-1);
  const progress = running ? analysisSteps[Math.min(state.events.length, 6)][1] : state.status === "completed" ? "Analysis complete" : state.status === "cancelled" ? "Analysis cancelled" : state.status === "error" ? "Analysis failed" : "Ready to analyze";
  return <section aria-labelledby="agent-title" className="min-w-0 rounded-sm border border-zinc-200 bg-white">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 bg-zinc-50/70 p-3 sm:p-4">
      <div><h2 id="agent-title" className="text-sm font-semibold">Demo intelligence</h2><p className="mt-1 text-xs leading-5 text-zinc-500">Local deterministic rules with staged events. No real LLM or external AI API.</p></div>
      {running && <button type="button" onClick={() => { analysis.cancel(); requestAnimationFrame(() => document.getElementById("run-analysis")?.focus()); }} className={reviewButton}>Cancel analysis</button>}
    </header>
    <div className="border-b border-zinc-200 px-3 py-2 sm:px-4">
      <p role="status" aria-live="polite" className="text-xs font-medium text-zinc-700">{progress}{running ? ` · ${state.events.length} of 7 events received` : ""}</p>
      {state.status === "cancelled" && <p className="mt-1 text-xs text-zinc-500">Partial results retained. No proposal was saved. Run again to restart.</p>}
      {state.status === "error" && <p role="alert" className="mt-1 text-xs text-red-800">{state.error} No proposal was saved. You can retry the analysis.</p>}
    </div>
    <ol aria-label="Simulated analysis events" className="divide-y divide-zinc-100">
      {analysisSteps.map(([type, label], index) => {
        const event = state.events.find(event => event.type === type || index === 6 && event.type === "analysis_completed");
        const active = running && index === state.events.length;
        return <li key={type} aria-current={active ? "step" : undefined} className={`flex gap-3 px-3 py-3 sm:px-4 ${active ? "bg-indigo-50/40" : ""}`}>
          <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-sm border text-[10px] ${event ? "border-zinc-300 text-zinc-700" : active ? "border-indigo-400 font-bold text-indigo-700" : "border-zinc-200 text-zinc-400"}`}>{event ? "✓" : index + 1}</span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-1"><h3 className={`text-xs font-medium ${event || active ? "text-zinc-800" : "text-zinc-400"}`}>{event?.type === "analysis_completed" ? "Complete without a proposal" : label}</h3><span className="text-[10px] text-zinc-500">{event ? "Complete" : active ? "In progress" : state.status === "cancelled" || state.status === "error" ? "Not run" : "Waiting"}</span></div>
            {event && <><p className="mt-1 break-words text-xs leading-5 text-zinc-500">{eventDetail(event)}</p><p className="mt-1 text-[10px] text-zinc-400"><code>{event.type}</code> · event {event.sequence}</p></>}
          </div>
        </li>;
      })}
    </ol>
    {changes.length > 0 && <div className="border-t border-zinc-200 p-3 sm:p-4">
      <h3 className="text-xs font-semibold">{proposal ? "Generated proposal" : "Detected changes · preliminary"}</h3>
      <dl className="mt-2 space-y-2">{changes.map(change => <div key={change.id} className="border-l-2 border-indigo-300 bg-indigo-50/30 px-3 py-2 text-xs"><dt className="font-medium text-zinc-700">{fieldLabel(change.field)}</dt><dd className="mt-1 break-words text-zinc-600"><span className="sr-only">Current value: </span>{displayFieldValue(change.field, change.before)}<span aria-hidden="true" className="mx-2">→</span><span className="sr-only"> Proposed value: </span>{displayFieldValue(change.field, change.after)}</dd></div>)}</dl>
      {proposal && <>
        <h4 className="mt-3 text-xs font-semibold text-zinc-700">Source evidence</h4>{proposal.evidence.map((evidence, index) => <blockquote key={index} className="mt-2 border-l-2 border-zinc-300 pl-3 text-xs leading-5 text-zinc-500">{evidence.text}</blockquote>)}
        <p className="mt-3 text-xs text-zinc-500">Pending suggestion · Nothing is applied to your CRM. Send it to the queue for human review.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={analysis.reviewBusy || queue.isSuccess} className={reviewPrimaryButton} onClick={() => queue.mutate(proposal)}>{queue.isPending ? "Sending…" : queue.isSuccess ? "In Review Queue" : "Send to Review Queue"}</button>
          {queue.isSuccess && <Link ref={queueLink} href="/reviews" className={reviewButton}>Open Review Queue</Link>}
        </div>
        {queue.isSuccess && <p role="status" className="mt-2 text-xs text-zinc-600">{queue.data.created ? "Proposal saved for human review." : "An identical pending proposal is already in the queue. No duplicate was created."}</p>}
        {queue.isError && <p role="alert" className="mt-2 text-xs text-red-800">Unable to queue this proposal: {queue.error.message}</p>}
      </>}
      {state.status === "cancelled" && <p className="mt-3 text-xs text-zinc-500">Preliminary changes are not a completed proposal and cannot be queued.</p>}
    </div>}
    {latest?.type === "analysis_completed" && <p className="border-t border-zinc-200 p-3 text-xs leading-5 text-zinc-600 sm:px-4">{latest.reason}</p>}
  </section>;
}

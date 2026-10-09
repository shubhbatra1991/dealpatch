"use client";

import Link from "next/link";
import type { RefObject } from "react";
import type { Contact } from "../../domain/contacts/contact";
import { displayTimestamp } from "../reviews/review-format";
import { reviewButton } from "../reviews/review-change";
import { AgentPanel } from "./agent-panel";
import { activityParticipants, type ActivityRow } from "./activity-model";
import type { useDemoAnalysis } from "./use-demo-analysis";

export function ActivityDetail({ row, contacts, analysis, onRun, detailRef }: { row: ActivityRow; contacts: Contact[]; analysis: ReturnType<typeof useDemoAnalysis>; onRun: () => void; detailRef: RefObject<HTMLDivElement | null> }) {
  const { activity, account, deal } = row;
  const participants = activityParticipants(activity, contacts);
  return <div className="min-w-0 space-y-3">
    <section aria-labelledby="source-title" className="workspace-panel rounded-sm border border-border bg-surface">
      <div id="activity-detail" ref={detailRef} tabIndex={-1} className="border-b border-border bg-bg-subtle/70 p-3"><h2 id="source-title" className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Selected activity</h2><h3 className="mt-1 break-words text-sm font-semibold">{activity.title}</h3><p className="mt-1 text-xs text-text-muted">{activity.type} · <time dateTime={activity.occurredAt}>{displayTimestamp(activity.occurredAt)}</time></p></div>
      <div className="space-y-3 p-3">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs"><dt className="text-text-muted">Account</dt><dd className="break-words text-text">{account ? <Link href={`/workspace/accounts/${encodeURIComponent(account.id)}`} className="rounded-sm underline">{account.name}</Link> : "Unavailable account"}</dd><dt className="text-text-muted">Deal</dt><dd className="break-words text-text">{deal ? <Link href={`/workspace/deals/${encodeURIComponent(deal.id)}`} className="rounded-sm underline">{deal.title}</Link> : activity.dealId ? "Unavailable deal" : "No linked deal"}</dd><dt className="text-text-muted">Participants</dt><dd className="break-words text-text">{participants.length ? <ul className="space-y-1">{participants.map((person, index) => <li key={`${person.id}-${index}`}>{person.available ? <Link href={`/workspace/contacts/${encodeURIComponent(person.id)}`} className="rounded-sm underline">{person.name}</Link> : person.name}</li>)}</ul> : "None linked"}</dd></dl>
        <div className="border-y border-border py-3"><h4 className="text-xs font-medium text-text-muted">Activity text</h4><p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-text">{activity.summary}</p></div>
        <button id="run-analysis" type="button" disabled={analysis.state.status === "running" || analysis.queue.isPending || analysis.checkingSource || Boolean(analysis.existingProposal)} onClick={onRun} className={reviewButton}>{analysis.state.status === "running" ? "Analyzing…" : analysis.state.status === "idle" ? "Run simulated analysis" : "Run again"}</button>
        <p className="text-[11px] leading-5 text-text-muted">Switching activities cancels the current run. Suggestions require an explicit send and human approval.</p>
      </div>
    </section>
    <AgentPanel analysis={analysis} row={row} />
  </div>;
}

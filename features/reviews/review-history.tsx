"use client";

import Link from "next/link";
import { isUnreviewed } from "../../domain/proposals/review";
import { useAccounts } from "../accounts/use-accounts";
import { accountHref } from "../accounts/accounts-model";
import { useAllProposals } from "./use-proposals";
import { ReviewOutcome } from "./review-outcome";
import { displayTimestamp } from "./review-format";

export function ReviewHistory() {
  const proposals = useAllProposals();
  const accounts = useAccounts();
  const completed = proposals.data?.filter(proposal => !proposal.changes.some(isUnreviewed)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) ?? [];
  const accountNames = new Map(accounts.data?.map(account => [account.id, account.name]));
  return <section aria-labelledby="review-history-title" className="border border-border bg-surface">
    <header className="border-b border-border bg-bg-subtle px-3 py-2"><h2 id="review-history-title" className="text-xs font-semibold">Reviewed proposals · {completed.length}</h2><p className="mt-1 text-[11px] text-text-muted">Field decisions are preserved. Account Changes tabs contain the append-only audit trail. Undo is offered in session approval notifications.</p></header>
    {proposals.isError ? <p role="alert" className="p-3 text-xs text-danger">Unable to refresh review history. <button type="button" onClick={() => void proposals.refetch()} className="underline">Retry</button></p> : proposals.isPending ? <p role="status" className="p-3 text-xs text-text-muted">Loading review history…</p> : !completed.length && <p className="p-3 text-xs text-text-muted">No completed review decisions yet.</p>}
    <ul className="divide-y divide-border">{completed.map(proposal => <li key={proposal.id}><details className="px-3 py-2"><summary className="cursor-pointer text-xs"><span className="font-medium">{accountNames.get(proposal.accountId) ?? proposal.accountId}</span> · {proposal.status === "PartiallyApproved" ? "Partially approved" : proposal.status} · {proposal.changes.length} fields <span className="text-text-muted">· Generated {displayTimestamp(proposal.createdAt)}</span></summary><ReviewOutcome proposal={proposal} /><Link href={accountHref(proposal.accountId)} className="mt-2 inline-block rounded-sm text-xs text-accent underline">View account</Link></details></li>)}</ul>
  </section>;
}

import type { AuditEvent } from "../../domain/audit/audit.types";
import type { ReviewItem } from "../../lib/repositories/reviews";
import type { Proposal } from "../../domain/proposals/proposal";
import { fieldLabel } from "./review-format";
import { proposalStatusLabel } from "./review-model";

export const historyFilters = ["All", "Approved", "Partially approved", "Rejected", "Superseded", "Undone / Reverted"] as const;
export type HistoryFilter = typeof historyFilters[number];
export const reviewHistoryHref = (id: string) => `/workspace/reviews/history?proposal=${encodeURIComponent(id)}`;
export function reviewHistoryStatus(proposal: Proposal, events: readonly AuditEvent[]) {
  return proposal.status === "Pending" && events.some(event => event.proposalId === proposal.id && event.action === "ApprovalUndone") ? "Undone / Reverted" : proposalStatusLabel(proposal.status);
}

function hasField(value: unknown, field: string) {
  return value !== null && typeof value === "object" && Object.hasOwn(value, field);
}

/** Derive decisions without inventing review timestamps or rewriting audit history. */
export function buildReviewHistory(items: ReviewItem[], audit: readonly AuditEvent[]) {
  const byProposal = new Map<string, AuditEvent[]>();
  for (const event of audit) {
    if (!event.proposalId) continue;
    const events = byProposal.get(event.proposalId) ?? [];
    events.push(event);
    byProposal.set(event.proposalId, events);
  }
  return items.flatMap(item => {
    const events = (byProposal.get(item.proposal.id) ?? []).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
    const decisions = events.filter(event => event.action !== "FieldEdited");
    if (item.proposal.status === "Pending" && !decisions.length) return [];
    const fields = item.changes.map(row => {
      const fieldEvents = events.filter(event => event.entityType === row.change.entityType && event.entityId === row.change.entityId && hasField(event.nextValue, row.change.field));
      const reverted = row.change.status !== "Approved" && fieldEvents.some(event => event.action === "ApprovalUndone");
      const outcome = row.change.status === "Approved" ? "Applied" : row.change.status === "Rejected" ? "Rejected" : reverted ? "Reverted" : row.conflict ? "Stale" : "Skipped";
      return { ...row, outcome, edited: Boolean(row.change.edited || row.change.status === "Edited"), events: fieldEvents };
    });
    const reverted = fields.some(field => field.outcome === "Reverted");
    const status = reviewHistoryStatus(item.proposal, events);
    return [{ item, events, fields, reverted, hasUndo: events.some(event => event.action === "ApprovalUndone"), status, reviewedAt: decisions.at(-1)?.occurredAt }];
  });
}
export type ReviewHistoryEntry = ReturnType<typeof buildReviewHistory>[number];

export function filterReviewHistory(entries: ReviewHistoryEntry[], { search = "", status = "All", accountId = "", oldest = false }: { search?: string; status?: HistoryFilter; accountId?: string; oldest?: boolean }) {
  const terms = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(entry => {
    if (accountId && entry.item.proposal.accountId !== accountId) return false;
    if (status !== "All" && (status === "Undone / Reverted" ? !entry.hasUndo : proposalStatusLabel(entry.item.proposal.status) !== status)) return false;
    const text = [entry.item.account, entry.item.deal, entry.item.source?.title, entry.item.proposal.id, entry.status, ...entry.fields.map(field => fieldLabel(field.change.field)), ...entry.item.proposal.evidence.map(evidence => evidence.text)].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => {
    const order = (a.reviewedAt ?? a.item.proposal.createdAt).localeCompare(b.reviewedAt ?? b.item.proposal.createdAt) || a.item.proposal.id.localeCompare(b.item.proposal.id);
    return oldest ? order : -order;
  });
}

export function auditFieldDiffs(event: AuditEvent) {
  const before = event.previousValue;
  const after = event.nextValue;
  if (event.entityType === "Proposal" || !before || !after || typeof before !== "object" || typeof after !== "object" || Array.isArray(after)) return [];
  return Object.keys(after).map(field => {
    const previous: unknown = Reflect.get(before, field);
    const next: unknown = Reflect.get(after, field);
    return { field, previous, next };
  });
}

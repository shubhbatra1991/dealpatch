import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import type { Deal } from "../../domain/deals/deal";
import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Proposal } from "../../domain/proposals/proposal";
import type { ProposalChange } from "../../domain/proposals/proposal-change";
import { isUnreviewed, proposalWithApproval, type ApprovalReceipt } from "../../domain/proposals/review";
import { queryKeys } from "../../lib/query/keys";
import { reviewRepository, type ReviewItem } from "../../lib/repositories/reviews";

export const reviewWriteKey = ["reviews", "write"] as const;
export const approvalKey = [...reviewWriteKey, "approve"] as const;
export const undoKey = [...reviewWriteKey, "undo"] as const;
const busyClients = new WeakSet<QueryClient>();
const cacheKeys = [queryKeys.proposals.all, queryKeys.deals.all, queryKeys.accounts.all, queryKeys.activities.all];
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// A single local review write prevents overlapping optimistic patches/undos.
export function acquireReviewWrite(client: QueryClient) {
  if (busyClients.has(client)) throw new Error("Another review is being saved. Please try again when it finishes.");
  busyClients.add(client);
}
export async function finishReviewWrite(client: QueryClient) {
  try { await Promise.all(cacheKeys.map(queryKey => client.invalidateQueries({ queryKey }))); }
  finally { busyClients.delete(client); }
}
async function cancelReads(client: QueryClient) {
  await Promise.all(cacheKeys.map(queryKey => client.cancelQueries({ queryKey })));
}

export interface ApprovalContext { receipt: ApprovalReceipt; item: ReviewItem }
export interface UndoRequest extends ApprovalContext { approvalId: number }
type Persistence = Pick<typeof reviewRepository, "approve" | "undo">;

function selectedChanges(receipt: ApprovalReceipt, undo: boolean): ProposalChange[] {
  return receipt.before.changes.filter(c => receipt.changeIds.includes(c.id)).map(c => undo ? { ...c, before: c.after, after: c.before } as ProposalChange : c);
}

/** Patch only affected fields/proposal, preserving unrelated cached edits and rows. */
export function applyApprovalCache(client: QueryClient, context: ApprovalContext, undo = false) {
  const { receipt, item } = context;
  const changes = selectedChanges(receipt, undo);
  const proposal = undo ? receipt.before : receipt.after;
  function patchRecord<T extends { id: string }>(record: T, entityType: ProposalChange["entityType"]): T {
    let updated = record;
    for (const change of changes.filter(c => c.entityType === entityType && c.entityId === record.id)) {
      if (equal(Reflect.get(updated, change.field), change.before)) updated = { ...updated, [change.field]: change.after === null ? undefined : change.after };
    }
    return updated;
  }
  client.setQueryData<Deal[]>(queryKeys.deals.list, data => data?.map(record => patchRecord(record, "Deal")));
  client.setQueryData<Account[]>(queryKeys.accounts.list, data => data?.map(record => patchRecord(record, "Account")));
  client.setQueryData<Activity[]>(queryKeys.activities.list, data => data?.map(record => patchRecord(record, "Activity")));
  const actionable = (p: Proposal) => ["Pending", "PartiallyApproved"].includes(p.status) && p.changes.some(isUnreviewed);
  client.setQueryData<Proposal[]>(queryKeys.proposals.pending, data => {
    if (!data) return data;
    const updated = data.filter(p => p.id !== proposal.id);
    if (actionable(proposal)) updated.push(proposal);
    return updated.sort((a,b) => a.createdAt.localeCompare(b.createdAt));
  });
  client.setQueryData<ReviewItem[]>(queryKeys.proposals.queue, data => {
    if (!data) return data;
    let updated = data;
    if (!updated.some(row => row.proposal.id === proposal.id) && actionable(proposal)) updated = [...updated, item];
    return updated.map(row => {
      const nextProposal = row.proposal.id === proposal.id ? proposal : row.proposal;
      const contextChange = (entity: ProposalChange["entityType"], id: string | undefined, field: string) => changes.find(c => c.entityType === entity && c.entityId === id && c.field === field);
      const accountName = contextChange("Account", row.proposal.accountId, "name");
      const dealTitle = contextChange("Deal", row.proposal.dealId, "title");
      const source = row.source ? patchRecord({ ...row.source, id: row.proposal.sourceActivityId }, "Activity") : undefined;
      return {
        ...row, proposal: nextProposal, source,
        account: accountName ? String(accountName.after) : row.account,
        deal: dealTitle ? String(dealTitle.after) : row.deal,
        changes: row.changes.map(previous => {
          const change = nextProposal.changes.find(c => c.id === previous.change.id)!;
          const patch = changes.find(c => c.entityType === change.entityType && c.entityId === change.entityId && c.field === change.field);
          const current = patch && equal(previous.current, patch.before) ? patch.after : previous.current;
          return { ...previous, change, current, conflict: patch ? !equal(current, change.before) : previous.conflict };
        }),
      };
    }).filter(row => actionable(row.proposal)).sort((a,b) => a.proposal.createdAt.localeCompare(b.proposal.createdAt));
  });
}

export function approvalMutationOptions(client: QueryClient, persistence: Persistence = reviewRepository) {
  return mutationOptions({
    mutationKey: approvalKey,
    gcTime: Infinity,
    retry: false,
    mutationFn: ({ id, changeIds }: { id: string; changeIds: string[] }) => persistence.approve(id, changeIds),
    onMutate: async ({ id, changeIds }): Promise<ApprovalContext> => {
      acquireReviewWrite(client);
      try {
        await cancelReads(client);
        const item = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)?.find(row => row.proposal.id === id);
        if (!item) throw new Error("The proposal is no longer in the queue. Refresh and try again.");
        if (item.changes.some(c => changeIds.includes(c.change.id) && c.conflict)) throw new Error("Resolve the current-value conflict before approval.");
        const receipt = { before: item.proposal, after: proposalWithApproval(item.proposal, changeIds), changeIds: [...changeIds] };
        const context = { receipt, item };
        applyApprovalCache(client, context);
        return context;
      } catch (error) { busyClients.delete(client); throw error; }
    },
    onError: (_error, _variables, context) => { if (context) applyApprovalCache(client, context, true); },
    onSettled: async (_data, _error, _variables, context) => { if (context) await finishReviewWrite(client); },
  });
}

export function undoMutationOptions(client: QueryClient, persistence: Persistence = reviewRepository) {
  return mutationOptions({
    mutationKey: undoKey,
    gcTime: Infinity,
    retry: false,
    mutationFn: ({ receipt }: UndoRequest) => persistence.undo(receipt),
    onMutate: async (request: UndoRequest) => {
      acquireReviewWrite(client);
      try {
        await cancelReads(client);
        const current = client.getQueryData<ReviewItem[]>(queryKeys.proposals.queue)?.find(row => row.proposal.id === request.receipt.after.id);
        if (current && !equal(current.proposal, request.receipt.after) || !current && request.receipt.after.changes.some(isUnreviewed)) throw new Error("The proposal was reviewed again. Undo the most recent approval first.");
        applyApprovalCache(client, request, true);
        return request;
      }
      catch (error) { busyClients.delete(client); throw error; }
    },
    onError: (_error, _variables, context) => { if (context) applyApprovalCache(client, context); },
    onSettled: async (_data, _error, _variables, context) => { if (context) await finishReviewWrite(client); },
  });
}

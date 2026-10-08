import type { Proposal } from "../../domain/proposals/proposal";
import type { ProposalChange } from "../../domain/proposals/proposal-change";
import { isUnreviewed, proposalWithApproval, reviewedStatus, type ApprovalReceipt } from "../../domain/proposals/review";
import { proposalChangeSchema, proposalSchema } from "../../domain/proposals/schema";
import { accountSchema } from "../../domain/accounts/schema";
import { contactSchema } from "../../domain/contacts/schema";
import { dealSchema } from "../../domain/deals/schema";
import { activitySchema } from "../../domain/activities/schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export { isUnreviewed } from "../../domain/proposals/review";
export interface ReviewChange { change: ProposalChange; current: unknown; target: string; conflict: boolean }
export interface ReviewItem {
  proposal: Proposal;
  account: string;
  deal?: string;
  source?: { title: string; type: string; summary: string; occurredAt: string };
  changes: ReviewChange[];
}
export type ReviewAction =
  | { type: "approve"; changeIds: string[] }
  | { type: "reject" }
  | { type: "edit"; changeId: string; value: unknown };

const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** All reads and writes belong to one local transaction, including stale-value checks. */
export function createReviewRepository(database?: DealPatchDatabase) {
  async function ready() {
    const db = database ?? getDatabase();
    await initializeWorkspace(db);
    return db;
  }
  function target(db: DealPatchDatabase, change: ProposalChange) {
    switch (change.entityType) {
      case "Account": return { table: db.accounts, schema: accountSchema };
      case "Contact": return { table: db.contacts, schema: contactSchema };
      case "Deal": return { table: db.deals, schema: dealSchema };
      case "Activity": return { table: db.activities, schema: activitySchema };
    }
  }
  async function recordFor(db: DealPatchDatabase, proposal: Proposal, change: ProposalChange) {
    const record = await target(db, change).table.get(change.entityId);
    if (!record || (change.entityType === "Account" ? record.id !== proposal.accountId : !("accountId" in record) || record.accountId !== proposal.accountId)) {
      throw new Error("The proposed record is missing or belongs to another account. Reject this proposal and review its source.");
    }
    return record;
  }
  async function writeField(db: DealPatchDatabase, proposal: Proposal, change: ProposalChange, undo = false) {
    const record = await recordFor(db, proposal, change);
    const expected = undo ? change.after : change.before;
    if (!equal(Reflect.get(record, change.field), expected)) throw new Error(undo
      ? "Undo could not be applied because an approved field was changed later. Your newer data was preserved."
      : "A current value changed since this proposal was generated. Nothing was applied. Refresh and review the conflict.");
    const value = undo ? change.before : change.after;
    const updated = target(db, change).schema.parse({ ...record, [change.field]: value === null ? undefined : value, ...(change.entityType === "Account" ? { updatedAt: new Date().toISOString() } : {}) });
    switch (change.entityType) {
      case "Account": await db.accounts.put(accountSchema.parse(updated)); break;
      case "Contact": await db.contacts.put(contactSchema.parse(updated)); break;
      case "Deal": await db.deals.put(dealSchema.parse(updated)); break;
      case "Activity": await db.activities.put(activitySchema.parse(updated)); break;
    }
  }
  const operations = {
    async getQueue(): Promise<ReviewItem[]> {
      const db = await ready();
      return db.transaction("r", [db.proposals, db.accounts, db.deals, db.contacts, db.activities], async () => {
        const proposals = (await db.proposals.toArray()).filter(p => ["Pending", "PartiallyApproved"].includes(p.status) && p.changes.some(isUnreviewed)).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
        return Promise.all(proposals.map(async proposal => {
          const account = await db.accounts.get(proposal.accountId);
          const deal = proposal.dealId ? await db.deals.get(proposal.dealId) : undefined;
          const source = await db.activities.get(proposal.sourceActivityId);
          const changes = await Promise.all(proposal.changes.map(async change => {
            let record;
            try { record = await recordFor(db, proposal, change); } catch { /* Missing targets remain visible for rejection. */ }
            const current: unknown = record ? Reflect.get(record, change.field) ?? null : null;
            const label = record && "firstName" in record ? `${record.firstName} ${record.lastName}` : record && "title" in record ? record.title : record && "name" in record ? record.name : change.entityId;
            return { change, current, target: `${change.entityType} · ${label}`, conflict: !record || !equal(current, change.before) };
          }));
          return { proposal, account: account?.name ?? "Missing account", deal: deal?.title, source, changes };
        }));
      });
    },
    async commit(id: string, action: ReviewAction): Promise<{ before: Proposal; after: Proposal }> {
      const db = await ready();
      return db.transaction("rw", [db.proposals, db.accounts, db.deals, db.contacts, db.activities], async () => {
        const stored = await db.proposals.get(id);
        if (!stored || !["Pending", "PartiallyApproved"].includes(stored.status) || !stored.changes.some(isUnreviewed)) throw new Error("This proposal has already been reviewed. Refresh the queue.");
        const proposal = proposalSchema.parse(stored);
        if (new Set(proposal.changes.map(change => change.id)).size !== proposal.changes.length) throw new Error("Proposal contains duplicate change identifiers. Nothing was applied.");
        let changes = proposal.changes;
        if (action.type === "edit") {
          const change = changes.find(c => c.id === action.changeId && isUnreviewed(c));
          if (!change) throw new Error("This change is no longer pending.");
          const edited = proposalChangeSchema.parse({ ...change, after: action.value, status: "Edited" });
          changes = changes.map(c => c.id === change.id ? edited : c);
        } else if (action.type === "reject") {
          changes = changes.map(c => isUnreviewed(c) ? { ...c, status: "Rejected", selected: false } : c);
        } else {
          const selected = new Set(action.changeIds);
          const approved = proposalWithApproval(proposal, action.changeIds);
          // Multiple patches to the same field would make the outcome ambiguous.
          const fields = new Set<string>();
          for (const change of changes.filter(c => selected.has(c.id))) {
            const key = `${change.entityType}:${change.entityId}:${change.field}`;
            if (fields.has(key)) throw new Error("Duplicate changes target the same field.");
            fields.add(key);
            await writeField(db, proposal, change);
          }
          changes = approved.changes;
        }
        const updated = proposalSchema.parse({ ...proposal, changes, status: reviewedStatus(changes) });
        await db.proposals.put(updated);
        return { before: proposal, after: updated };
      });
    },
  };
  return {
    getQueue: operations.getQueue,
    async review(id: string, action: ReviewAction) { return (await operations.commit(id, action)).after; },
    async approve(id: string, changeIds: string[]): Promise<ApprovalReceipt> {
      return { ...await operations.commit(id, { type: "approve", changeIds }), changeIds: [...changeIds] };
    },
    async undo(receipt: ApprovalReceipt): Promise<Proposal> {
      const before = proposalSchema.parse(receipt.before);
      const after = proposalSchema.parse(receipt.after);
      if (!equal(proposalWithApproval(before, receipt.changeIds), after)) throw new Error("Invalid approval receipt.");
      const db = await ready();
      return db.transaction("rw", [db.proposals, db.accounts, db.deals, db.contacts, db.activities], async () => {
        const current = await db.proposals.get(after.id);
        if (!equal(current, after)) throw new Error("This proposal was reviewed or edited again. Undo the most recent approval first; newer decisions were preserved.");
        for (const change of before.changes.filter(c => receipt.changeIds.includes(c.id))) await writeField(db, before, change, true);
        await db.proposals.put(before);
        return before;
      });
    },
  };
}

export const reviewRepository = createReviewRepository();

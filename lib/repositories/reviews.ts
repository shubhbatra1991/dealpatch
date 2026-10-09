import type { Proposal } from "../../domain/proposals/proposal";
import type { ProposalChange } from "../../domain/proposals/proposal-change";
import { isProposalChangeStale, isUnreviewed, proposalWithApproval, reviewedStatus, type ApprovalReceipt } from "../../domain/proposals/review";
import { assertDealStageTransition } from "../../domain/deals/rules";
import type { AuditAction } from "../../domain/audit/audit.types";
import { proposalChangeSchema, proposalSchema } from "../../domain/proposals/schema";
import { accountSchema } from "../../domain/accounts/schema";
import { contactSchema } from "../../domain/contacts/schema";
import { dealSchema } from "../../domain/deals/schema";
import { activitySchema } from "../../domain/activities/schema";
import { auditEventSchema } from "../../domain/audit/audit.schema";
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
    // Validate storage without transforming the live snapshot used for staleness.
    target(db, change).schema.parse(record);
    return record;
  }
  async function validateField(db: DealPatchDatabase, proposal: Proposal, change: ProposalChange, undo = false) {
    const record = await recordFor(db, proposal, change);
    const value = undo ? change.before : change.after;
    const updated = target(db, change).schema.parse({ ...record, [change.field]: value === null ? undefined : value, ...(change.entityType === "Account" ? { updatedAt: new Date().toISOString() } : {}) });
    if (!undo && change.entityType === "Deal" && change.field === "stage") assertDealStageTransition(dealSchema.parse(record).stage, change.after);
    if (change.entityType === "Activity" && change.field === "participants") {
      for (const id of (undo ? change.before : change.after) ?? []) {
        const contact = await db.contacts.get(id);
        if (!contact || contact.accountId !== proposal.accountId) throw new Error("Participants must be contacts belonging to this account.");
      }
    }
    return { record, updated };
  }
  async function writeField(db: DealPatchDatabase, proposal: Proposal, change: ProposalChange, action: AuditAction, undo = false) {
    const record = await recordFor(db, proposal, change);
    const expected = undo ? change.after : change.before;
    if (isProposalChangeStale(undo ? { ...change, before: change.after } as ProposalChange : change, Reflect.get(record, change.field))) throw new Error(undo
      ? "Undo could not be applied because an approved field was changed later. Your newer data was preserved."
      : "A current value changed since this proposal was generated. Nothing was applied. Refresh and review the stale change; reject it or generate a new proposal.");
    const { updated } = await validateField(db, proposal, change, undo);
    const value = undo ? change.before : change.after;
    switch (change.entityType) {
      case "Account": await db.accounts.put(accountSchema.parse(updated)); break;
      case "Contact": await db.contacts.put(contactSchema.parse(updated)); break;
      case "Deal": await db.deals.put(dealSchema.parse(updated)); break;
      case "Activity": await db.activities.put(activitySchema.parse(updated)); break;
    }
    await db.auditEvents.add(auditEventSchema.parse({
      id: crypto.randomUUID(), entityType: change.entityType, entityId: change.entityId,
      action, proposalId: proposal.id,
      previousValue: { [change.field]: expected }, nextValue: { [change.field]: value },
      occurredAt: new Date().toISOString(),
    }));
  }
  const operations = {
    async getAll(): Promise<ReviewItem[]> {
      const db = await ready();
      return db.transaction("r", [db.proposals, db.accounts, db.deals, db.contacts, db.activities], async () => {
        const proposals = (await db.proposals.toArray()).map(p => proposalSchema.parse(p)).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
        const changes = proposals.flatMap(proposal => proposal.changes);
        const ids = (type: ProposalChange["entityType"]) => changes.filter(change => change.entityType === type).map(change => change.entityId);
        // Batch referenced IDs, not the whole activity/contact store. A queue of
        // 1,000 proposals previously issued thousands of individual get requests.
        const [accounts, deals, contacts, activities] = await Promise.all([
          db.accounts.bulkGet([...new Set([...proposals.map(p => p.accountId), ...ids("Account")])]),
          db.deals.bulkGet([...new Set([...proposals.flatMap(p => p.dealId ? [p.dealId] : []), ...ids("Deal")])]),
          db.contacts.bulkGet([...new Set(ids("Contact"))]),
          db.activities.bulkGet([...new Set([...proposals.map(p => p.sourceActivityId), ...ids("Activity")])]),
        ]);
        const accountMap = new Map(accounts.flatMap(record => record ? [[record.id, record] as const] : []));
        const dealMap = new Map(deals.flatMap(record => record ? [[record.id, record] as const] : []));
        const contactMap = new Map(contacts.flatMap(record => record ? [[record.id, record] as const] : []));
        const activityMap = new Map(activities.flatMap(record => record ? [[record.id, record] as const] : []));
        const records = { Account: accountMap, Deal: dealMap, Contact: contactMap, Activity: activityMap };
        return proposals.map(proposal => {
          const account = accountMap.get(proposal.accountId);
          const deal = proposal.dealId ? dealMap.get(proposal.dealId) : undefined;
          const source = activityMap.get(proposal.sourceActivityId);
          const changes = proposal.changes.map(change => {
            let record;
            try {
              const candidate = records[change.entityType].get(change.entityId);
              if (candidate && (change.entityType === "Account" ? candidate.id === proposal.accountId : "accountId" in candidate && candidate.accountId === proposal.accountId)) { target(db, change).schema.parse(candidate); record = candidate; }
            } catch { /* Invalid targets remain visible for rejection, never application. */ }
            const current: unknown = record ? Reflect.get(record, change.field) ?? null : null;
            const label = record && "firstName" in record ? `${record.firstName} ${record.lastName}` : record && "title" in record ? record.title : record && "name" in record ? record.name : change.entityId;
            return { change, current, target: `${change.entityType} · ${label}`, conflict: isUnreviewed(change) && (!record || isProposalChangeStale(change, current)) };
          });
          return { proposal, account: account?.name ?? "Missing account", deal: deal?.accountId === proposal.accountId ? deal.title : undefined, source: source?.accountId === proposal.accountId ? source : undefined, changes };
        });
      });
    },
    async commit(id: string, action: ReviewAction, expectedProposal?: Proposal): Promise<{ before: Proposal; after: Proposal }> {
      const db = await ready();
      return db.transaction("rw", [db.proposals, db.accounts, db.deals, db.contacts, db.activities, db.auditEvents], async () => {
        const stored = await db.proposals.get(id);
        if (!stored || !["Pending", "PartiallyApproved"].includes(stored.status) || !stored.changes.some(isUnreviewed)) throw new Error("This proposal has already been reviewed. Refresh the queue.");
        const proposal = proposalSchema.parse(stored);
        if (expectedProposal && !equal(proposal, expectedProposal)) throw new Error("This proposal was edited or reviewed after you loaded it. Nothing was applied. Refresh and review the latest suggestion.");
        if (new Set(proposal.changes.map(change => change.id)).size !== proposal.changes.length) throw new Error("Proposal contains duplicate change identifiers. Nothing was applied.");
        let changes = proposal.changes;
        if (action.type === "edit") {
          const change = changes.find(c => c.id === action.changeId && isUnreviewed(c));
          if (!change) throw new Error("This change is no longer pending.");
          const edited = proposalChangeSchema.parse({ ...change, after: action.value, status: "Edited", edited: true });
          await validateField(db, proposal, edited);
          changes = changes.map(c => c.id === change.id ? edited : c);
        } else if (action.type === "reject") {
          changes = changes.map(c => isUnreviewed(c) ? { ...c, ...(c.status === "Edited" ? { edited: true } : {}), status: "Rejected", selected: false } : c);
        } else {
          const selected = new Set(action.changeIds);
          const approved = proposalWithApproval(proposal, action.changeIds);
          // Multiple patches to the same field would make the outcome ambiguous.
          const fields = new Set<string>();
          for (const change of changes.filter(c => selected.has(c.id))) {
            const key = `${change.entityType}:${change.entityId}:${change.field}`;
            if (fields.has(key)) throw new Error("Duplicate changes target the same field.");
            fields.add(key);
            await writeField(db, proposal, change, approved.status === "PartiallyApproved" ? "ProposalPartiallyApproved" : "ProposalApproved");
          }
          changes = approved.changes;
        }
        const updated = proposalSchema.parse({ ...proposal, changes, status: reviewedStatus(changes) });
        await db.proposals.put(updated);
        if (action.type !== "approve") {
          const snapshot = (record: Proposal) => ({ status: record.status, changes: record.changes.map(change => ({ id: change.id, entityType: change.entityType, entityId: change.entityId, field: change.field, before: change.before, after: change.after, status: change.status, edited: change.edited ?? change.status === "Edited" })) });
          await db.auditEvents.add(auditEventSchema.parse({
            id: crypto.randomUUID(), entityType: "Proposal", entityId: proposal.id,
            action: action.type === "reject" ? "ProposalRejected" : "FieldEdited", proposalId: proposal.id,
            previousValue: snapshot(proposal), nextValue: snapshot(updated), occurredAt: new Date().toISOString(),
          }));
        }
        return { before: proposal, after: updated };
      });
    },
  };
  return {
    getAll: operations.getAll,
    async getQueue() { return (await operations.getAll()).filter(item => ["Pending", "PartiallyApproved"].includes(item.proposal.status) && item.proposal.changes.some(isUnreviewed)); },
    async review(id: string, action: ReviewAction, expectedProposal?: Proposal) { return (await operations.commit(id, action, expectedProposal)).after; },
    async approve(id: string, changeIds: string[], expectedProposal?: Proposal): Promise<ApprovalReceipt> {
      return { ...await operations.commit(id, { type: "approve", changeIds }, expectedProposal), changeIds: [...changeIds] };
    },
    async undo(receipt: ApprovalReceipt): Promise<Proposal> {
      const before = proposalSchema.parse(receipt.before);
      const after = proposalSchema.parse(receipt.after);
      if (!equal(proposalWithApproval(before, receipt.changeIds), after)) throw new Error("Invalid approval receipt.");
      const db = await ready();
      return db.transaction("rw", [db.proposals, db.accounts, db.deals, db.contacts, db.activities, db.auditEvents], async () => {
        const current = await db.proposals.get(after.id);
        if (!equal(current, after)) throw new Error("This proposal was reviewed or edited again. Undo the most recent approval first; newer decisions were preserved.");
        for (const change of before.changes.filter(c => receipt.changeIds.includes(c.id))) await writeField(db, before, change, "ApprovalUndone", true);
        await db.proposals.put(before);
        return before;
      });
    },
  };
}

export const reviewRepository = createReviewRepository();

import type { Proposal, ProposalStatus } from "../../domain/proposals/proposal";
import type { ProposalChange } from "../../domain/proposals/proposal-change";
import { proposalSchema } from "../../domain/proposals/schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export interface ProposalRepository {
  getPending(): Promise<Proposal[]>;
  getById(id: string): Promise<Proposal | undefined>;
  updateStatus(id: string, status: ProposalStatus): Promise<Proposal>;
  updateChanges(id: string, changes: ProposalChange[]): Promise<Proposal>;
  queueGenerated(proposal: Proposal): Promise<{ proposal: Proposal; created: boolean }>;
}

export function createProposalRepository(database?: DealPatchDatabase): ProposalRepository {
  async function ready() {
    const db = database ?? getDatabase();
    await initializeWorkspace(db);
    return db;
  }

  async function update(id: string, patch: Pick<Proposal, "status"> | Pick<Proposal, "changes">) {
    const db = await ready();
    return db.transaction("rw", db.proposals, async () => {
      const current = await db.proposals.get(id);
      if (!current) throw new Error(`Proposal "${id}" was not found.`);
      const updated = proposalSchema.parse({ ...current, ...patch });
      await db.proposals.put(updated);
      return updated;
    });
  }

  return {
    async getPending() {
      // Oldest first, so earlier proposals are reviewed before newer ones.
      return (await (await ready()).proposals.where("status").anyOf("Pending", "PartiallyApproved").sortBy("createdAt"))
        .filter(proposal => proposal.changes.some(change => change.status === "Pending" || change.status === "Edited"));
    },
    async getById(id) {
      return (await ready()).proposals.get(id);
    },
    async updateStatus(id, status) {
      return update(id, { status: proposalSchema.shape.status.parse(status) });
    },
    async updateChanges(id, changes) {
      return update(id, { changes: proposalSchema.shape.changes.parse(changes) });
    },
    async queueGenerated(input) {
      const proposal = proposalSchema.parse(input);
      if (proposal.status !== "Pending" || proposal.changes.some(change => change.status !== "Pending" || change.entityType !== "Deal")) throw new Error("Demo intelligence can queue pending deal suggestions only.");
      if (new Set(proposal.changes.map(change => change.id)).size !== proposal.changes.length || new Set(proposal.changes.map(change => change.field)).size !== proposal.changes.length) throw new Error("The draft contains duplicate field changes. Run the analysis again.");
      const db = await ready();
      return db.transaction("rw", [db.proposals, db.activities, db.accounts, db.deals], async () => {
        const source = await db.activities.get(proposal.sourceActivityId);
        const account = await db.accounts.get(proposal.accountId);
        const deal = proposal.dealId ? await db.deals.get(proposal.dealId) : undefined;
        if (!source || !account || !deal || source.accountId !== account.id || source.dealId !== deal.id || deal.accountId !== account.id) throw new Error("The activity, account or deal changed. Run the analysis again.");
        if (proposal.evidence.some(evidence => evidence.sourceActivityId !== source.id || !source.summary.includes(evidence.text))) throw new Error("The source activity changed. Run the analysis again.");
        for (const change of proposal.changes) {
          if (change.entityId !== deal.id || JSON.stringify(Reflect.get(deal, change.field) ?? null) !== JSON.stringify(change.before)) throw new Error("A current deal value changed. Run the analysis again before sending this suggestion.");
        }
        const signature = (changes: ProposalChange[]) => JSON.stringify(changes.filter(change => change.status === "Pending" || change.status === "Edited").map(change => JSON.stringify([change.entityType, change.entityId, change.field, change.before, change.after])).sort());
        const existing = (await db.proposals.where("sourceActivityId").equals(source.id).toArray()).find(candidate => ["Pending", "PartiallyApproved"].includes(candidate.status) && signature(candidate.changes) === signature(proposal.changes));
        if (existing) return { proposal: existing, created: false };
        if (await db.proposals.get(proposal.id)) throw new Error("This proposal was already saved. Run the analysis again to generate a new suggestion.");
        await db.proposals.add(proposal);
        return { proposal, created: true };
      });
    },
  };
}

export const proposalRepository: ProposalRepository = createProposalRepository();

import { auditEventSchema } from "../../domain/audit/audit.schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

/** Read-only history API. Appends occur inside the owning mutation transaction. */
export function createAuditRepository(database?: DealPatchDatabase) {
  return {
    async getByAccountId(accountId: string) {
      const db = database ?? getDatabase();
      await initializeWorkspace(db);
      return db.transaction("r", db.tables, async () => {
        if (!(await db.accounts.get(accountId))) return [];
        const [contacts, deals, activities, proposals] = await Promise.all([
          db.contacts.where("accountId").equals(accountId).primaryKeys(),
          db.deals.where("accountId").equals(accountId).primaryKeys(),
          db.activities.where("accountId").equals(accountId).primaryKeys(),
          db.proposals.where("accountId").equals(accountId).primaryKeys(),
        ]);
        const targets: [string, string][] = [["Account", accountId], ...contacts.map(id => ["Contact", id] as [string, string]), ...deals.map(id => ["Deal", id] as [string, string]), ...activities.map(id => ["Activity", id] as [string, string]), ...proposals.map(id => ["Proposal", id] as [string, string])];
        // Proposal association retains history even if a target is no longer present.
        const [byTarget, byProposal] = await Promise.all([
          db.auditEvents.where("[entityType+entityId]").anyOf(targets).toArray(),
          db.auditEvents.where("proposalId").anyOf(proposals).toArray(),
        ]);
        return [...new Map([...byTarget, ...byProposal].map(event => [event.id, event])).values()]
          .map(event => auditEventSchema.parse(event))
          .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id));
      });
    },
  };
}
export const auditRepository = createAuditRepository();

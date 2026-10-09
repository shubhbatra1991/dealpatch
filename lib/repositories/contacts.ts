import { contactSchema } from "../../domain/contacts/schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

/** Validated browser-local reads for account and contact surfaces. */
export function createContactRepository(database?: DealPatchDatabase) {
  return {
    async getAll() {
      const db = database ?? getDatabase();
      await initializeWorkspace(db);
      return (await db.contacts.toArray()).map(record => contactSchema.parse(record));
    },
    async getByAccountId(accountId: string) {
      const db = database ?? getDatabase();
      await initializeWorkspace(db);
      return (await db.contacts.where("accountId").equals(accountId).toArray()).map(record => contactSchema.parse(record));
    },
  };
}
export const contactRepository = createContactRepository();

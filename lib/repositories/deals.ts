import type { Deal } from "../../domain/deals/deal";
import { dealSchema } from "../../domain/deals/schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export type DealUpdate = Partial<Omit<Deal, "id" | "accountId">>;

export interface DealRepository {
  getAll(): Promise<Deal[]>;
  getById(id: string): Promise<Deal | undefined>;
  update(id: string, changes: DealUpdate): Promise<Deal>;
}

const updateSchema = dealSchema.omit({ id: true, accountId: true }).partial();

export function createDealRepository(database?: DealPatchDatabase): DealRepository {
  async function ready() {
    const db = database ?? getDatabase();
    await initializeWorkspace(db);
    return db;
  }

  return {
    async getAll() {
      return (await (await ready()).deals.toArray()).map(record => dealSchema.parse(record));
    },
    async getById(id) {
      const record = await (await ready()).deals.get(id);
      return record === undefined ? undefined : dealSchema.parse(record);
    },
    async update(id, changes) {
      const patch = updateSchema.parse(changes);
      const db = await ready();
      return db.transaction("rw", db.deals, async () => {
        const current = await db.deals.get(id);
        if (!current) throw new Error(`Deal "${id}" was not found.`);
        const updated = dealSchema.parse({ ...current, ...patch });
        await db.deals.put(updated);
        return updated;
      });
    },
  };
}

// Safe to import during SSR: the database is resolved only when a method runs.
export const dealRepository: DealRepository = createDealRepository();

import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export function createActivityRepository(database?: DealPatchDatabase) {
  return {
    async getAll() {
      const db = database ?? getDatabase();
      await initializeWorkspace(db);
      return db.activities.orderBy("occurredAt").reverse().toArray();
    },
  };
}
export const activityRepository = createActivityRepository();

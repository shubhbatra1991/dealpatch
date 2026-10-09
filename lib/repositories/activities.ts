import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";
import { activitySchema } from "../../domain/activities/schema";

export function createActivityRepository(database?: DealPatchDatabase) {
  return {
    async getAll() {
      const db = database ?? getDatabase();
      await initializeWorkspace(db);
      return (await db.activities.orderBy("occurredAt").reverse().toArray()).map(record => activitySchema.parse(record));
    },
  };
}
export const activityRepository = createActivityRepository();

import type { Favorite, FavoriteTarget } from "../../domain/favorites/favorite";
import { favoriteSchema, favoriteTargetSchema } from "../../domain/favorites/schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export interface FavoriteRepository {
  getAll(): Promise<Favorite[]>;
  setFavorite(target: FavoriteTarget, enabled: boolean): Promise<Favorite | undefined>;
}

export function createFavoriteRepository(database?: DealPatchDatabase): FavoriteRepository {
  async function ready() {
    const db = database ?? getDatabase();
    await initializeWorkspace(db);
    return db;
  }
  return {
    async getAll() {
      return (await (await ready()).favorites.toArray()).map(record => favoriteSchema.parse(record))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    },
    async setFavorite(input, enabled) {
      const target = favoriteTargetSchema.parse(input);
      if (typeof enabled !== "boolean") throw new Error("Choose whether to add or remove the favorite.");
      const db = await ready();
      return db.transaction("rw", [db.favorites, db.accounts, db.contacts, db.deals], async () => {
        const existing = await db.favorites.where("[entityType+entityId]").equals([target.entityType, target.entityId]).first();
        if (!enabled) {
          if (existing) await db.favorites.delete(existing.id);
          return undefined;
        }
        const table = target.entityType === "account" ? db.accounts : target.entityType === "contact" ? db.contacts : db.deals;
        if (!(await table.get(target.entityId))) throw new Error("This record is no longer available. It cannot be added to favorites.");
        if (existing) return favoriteSchema.parse(existing);
        const favorite = favoriteSchema.parse({ ...target, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
        await db.favorites.add(favorite);
        return favorite;
      });
    },
  };
}

export const favoriteRepository = createFavoriteRepository();

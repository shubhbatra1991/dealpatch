import type { PipelineViewConfig, SavedView } from "../../domain/saved-views/saved-view";
import { savedViewInputSchema, savedViewNameSchema, savedViewSchema } from "../../domain/saved-views/schema";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export interface SavedViewRepository {
  getAll(): Promise<SavedView[]>;
  create(input: PipelineViewConfig & { name: string; entityType: "pipeline" }): Promise<SavedView>;
  rename(id: string, name: string): Promise<SavedView>;
  delete(id: string): Promise<void>;
}

export function createSavedViewRepository(database?: DealPatchDatabase): SavedViewRepository {
  async function ready() {
    const db = database ?? getDatabase();
    await initializeWorkspace(db);
    return db;
  }
  // Name comparison is case-insensitive and ignores surrounding whitespace.
  async function checkName(db: DealPatchDatabase, name: string, exceptId?: string) {
    const existing = await db.savedViews.toArray();
    if (existing.some(view => view.id !== exceptId && view.name.trim().toLowerCase() === name.toLowerCase())) throw new Error("A Pipeline view with this name already exists.");
  }
  return {
    async getAll() {
      return (await (await ready()).savedViews.toArray()).map(view => savedViewSchema.parse(view))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    },
    async create(input) {
      const config = savedViewInputSchema.parse(input);
      const db = await ready();
      return db.transaction("rw", db.savedViews, async () => {
        await checkName(db, config.name);
        const now = new Date().toISOString();
        const view = savedViewSchema.parse({ ...config, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
        await db.savedViews.add(view);
        return view;
      });
    },
    async rename(id, input) {
      const name = savedViewNameSchema.parse(input);
      const db = await ready();
      return db.transaction("rw", db.savedViews, async () => {
        const existing = await db.savedViews.get(id);
        if (!existing) throw new Error("This saved view is no longer available.");
        await checkName(db, name, id);
        const view = savedViewSchema.parse({ ...existing, name, updatedAt: new Date().toISOString() });
        await db.savedViews.put(view);
        return view;
      });
    },
    async delete(id) { await (await ready()).savedViews.delete(id); },
  };
}

export const savedViewRepository = createSavedViewRepository();

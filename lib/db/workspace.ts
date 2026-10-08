import { getDatabase, type DealPatchDatabase } from "./database";
import type { SeedData } from "./seed";

async function isEmpty(database: DealPatchDatabase): Promise<boolean> {
  const counts = await Promise.all(database.tables.map((table) => table.count()));
  return counts.every((count) => count === 0);
}

/** Called only within a transaction covering all five stores. */
async function writeSeedData(database: DealPatchDatabase, seed: SeedData): Promise<void> {
  await database.accounts.bulkAdd(seed.accounts);
  await database.contacts.bulkAdd(seed.contacts);
  await database.deals.bulkAdd(seed.deals);
  await database.activities.bulkAdd(seed.activities);
  await database.proposals.bulkAdd(seed.proposals);
}

/** Preserve any nonempty workspace, including a deliberately partial one. */
export async function initializeWorkspace(database = getDatabase()): Promise<void> {
  const empty = await database.transaction("r", database.tables, () => isEmpty(database));
  if (!empty) return;

  // Imports and validation must happen outside the IndexedDB transaction.
  // Existing workspaces never need to load the JSON chunk.
  const { loadSeedData } = await import("./seed");
  const seed = loadSeedData();
  await database.transaction("rw", database.tables, async () => {
    // Another tab or Strict Mode effect may have seeded while we were loading.
    if (!(await isEmpty(database))) return;
    await writeSeedData(database, seed);
  });
}

/** Explicitly discard local edits and atomically restore the demo snapshot. */
export async function resetWorkspace(database = getDatabase()): Promise<void> {
  const { loadSeedData } = await import("./seed");
  const seed = loadSeedData();
  await database.transaction("rw", database.tables, async () => {
    for (const table of database.tables) await table.clear();
    await writeSeedData(database, seed);
  });
}

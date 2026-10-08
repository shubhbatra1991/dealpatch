import accounts from "../../data/seed/accounts.json";
import contacts from "../../data/seed/contacts.json";
import deals from "../../data/seed/deals.json";
import activities from "../../data/seed/activities.json";
import proposals from "../../data/seed/proposals.json";
import { seedDataSchema } from "../../data/seed/validate";

export type SeedData = ReturnType<typeof loadSeedData>;

/** Validate and clone the snapshot before starting any write transaction. */
export function loadSeedData() {
  return seedDataSchema.parse({ accounts, contacts, deals, activities, proposals });
}

import accounts from "../data/seed/accounts.json";
import contacts from "../data/seed/contacts.json";
import deals from "../data/seed/deals.json";
import activities from "../data/seed/activities.json";
import proposals from "../data/seed/proposals.json";
import { seedDataSchema } from "../data/seed/validate";

const result = seedDataSchema.safeParse({ accounts, contacts, deals, activities, proposals });
if (!result.success) {
  console.error(result.error.issues);
  process.exitCode = 1;
} else {
  console.log("Seed schemas and relationship integrity passed:");
  for (const [name, records] of Object.entries(result.data)) console.log(`  ${name}: ${records.length}`);
}

import Dexie, { type Table } from "dexie";
import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { Proposal } from "../../domain/proposals/proposal";
import { DATABASE_NAME, DATABASE_VERSION, VERSION_1_STORES } from "./schema";

export class DealPatchDatabase extends Dexie {
  accounts!: Table<Account, string>;
  contacts!: Table<Contact, string>;
  deals!: Table<Deal, string>;
  activities!: Table<Activity, string>;
  proposals!: Table<Proposal, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(DATABASE_VERSION).stores(VERSION_1_STORES);
  }
}

let database: DealPatchDatabase | undefined;

/** Lazy browser-only instance. Importing this module never opens IndexedDB. */
export function getDatabase(): DealPatchDatabase {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("DealPatch requires IndexedDB in a browser to save this workspace.");
  }
  database ??= new DealPatchDatabase();
  return database;
}

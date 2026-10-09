import Dexie, { type Table } from "dexie";
import type { Account } from "../../domain/accounts/account";
import type { Activity } from "../../domain/activities/activity";
import type { Contact } from "../../domain/contacts/contact";
import type { Deal } from "../../domain/deals/deal";
import type { Proposal } from "../../domain/proposals/proposal";
import type { AuditEvent } from "../../domain/audit/audit.types";
import type { Favorite } from "../../domain/favorites/favorite";
import type { SavedView } from "../../domain/saved-views/saved-view";
import { DATABASE_NAME, DATABASE_VERSION, VERSION_1_STORES, VERSION_2_STORES, VERSION_3_STORES, VERSION_4_STORES } from "./schema";

export class DealPatchDatabase extends Dexie {
  accounts!: Table<Account, string>;
  contacts!: Table<Contact, string>;
  deals!: Table<Deal, string>;
  activities!: Table<Activity, string>;
  proposals!: Table<Proposal, string>;
  auditEvents!: Table<AuditEvent, string>;
  favorites!: Table<Favorite, string>;
  savedViews!: Table<SavedView, string>;

  constructor(name = DATABASE_NAME) {
    super(name);
    this.version(1).stores(VERSION_1_STORES);
    this.version(2).stores(VERSION_2_STORES);
    this.version(3).stores(VERSION_3_STORES);
    this.version(DATABASE_VERSION).stores(VERSION_4_STORES);
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

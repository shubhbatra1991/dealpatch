import type { Account } from "../../domain/accounts/account";
import { getDatabase, type DealPatchDatabase } from "../db/database";
import { initializeWorkspace } from "../db/workspace";

export interface AccountRepository {
  getAll(): Promise<Account[]>;
  getById(id: string): Promise<Account | undefined>;
}

export function createAccountRepository(database?: DealPatchDatabase): AccountRepository {
  async function ready() {
    const db = database ?? getDatabase();
    await initializeWorkspace(db);
    return db;
  }

  return {
    async getAll() {
      return (await ready()).accounts.toArray();
    },
    async getById(id) {
      return (await ready()).accounts.get(id);
    },
  };
}

export const accountRepository: AccountRepository = createAccountRepository();

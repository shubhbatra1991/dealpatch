import type { Account } from "../../domain/accounts/account";
import { accountSchema } from "../../domain/accounts/schema";
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
      return (await (await ready()).accounts.toArray()).map(record => accountSchema.parse(record));
    },
    async getById(id) {
      const record = await (await ready()).accounts.get(id);
      return record === undefined ? undefined : accountSchema.parse(record);
    },
  };
}

export const accountRepository: AccountRepository = createAccountRepository();

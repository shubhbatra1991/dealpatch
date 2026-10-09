export const queryKeys = {
  savedViews: {
    list: ["savedViews", "pipeline"] as const,
  },
  favorites: {
    all: ["favorites"] as const,
    list: ["favorites", "list"] as const,
    writes: ["favorites", "write"] as const,
    write: (entityType: string, entityId: string) => ["favorites", "write", entityType, entityId] as const,
  },
  audit: {
    all: ["audit"] as const,
    forAccount: (accountId: string) => ["audit", "account", accountId] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: ["contacts", "list"] as const,
    forAccount: (accountId: string) => ["contacts", "account", accountId] as const,
  },
  activities: {
    all: ["activities"] as const,
    list: ["activities", "list"] as const,
  },
  deals: {
    all: ["deals"] as const,
    list: ["deals", "list"] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    list: ["accounts", "list"] as const,
  },
  proposals: {
    all: ["proposals"] as const,
    list: ["proposals", "list"] as const,
    pending: ["proposals", "pending"] as const,
    queue: ["proposals", "queue"] as const,
    reviewItems: ["proposals", "reviewItems"] as const,
    forAccount: (accountId: string) => ["proposals", "account", accountId] as const,
  },
} as const;

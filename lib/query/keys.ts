export const queryKeys = {
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
    pending: ["proposals", "pending"] as const,
    queue: ["proposals", "queue"] as const,
  },
} as const;

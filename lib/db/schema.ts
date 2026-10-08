export const DATABASE_NAME = "dealpatch";
export const DATABASE_VERSION = 1;

// Only primary keys and fields used for filtering/relationships are indexed.
// Future migrations must add a new version instead of changing version 1.
export const VERSION_1_STORES = {
  accounts: "id, name, ownerId, status",
  contacts: "id, accountId, status",
  deals: "id, accountId, stage, ownerId, risk",
  activities: "id, accountId, dealId, occurredAt",
  proposals: "id, accountId, dealId, sourceActivityId, status, createdAt",
} as const;

export const DATABASE_NAME = "dealpatch";
export const DATABASE_VERSION = 4;

// Only primary keys and fields used for filtering/relationships are indexed.
// Future migrations must add a new version instead of changing version 1.
export const VERSION_1_STORES = {
  accounts: "id, name, ownerId, status",
  contacts: "id, accountId, status",
  deals: "id, accountId, stage, ownerId, risk",
  activities: "id, accountId, dealId, occurredAt",
  proposals: "id, accountId, dealId, sourceActivityId, status, createdAt",
} as const;

export const VERSION_2_STORES = {
  ...VERSION_1_STORES,
  auditEvents: "id, [entityType+entityId], proposalId, occurredAt",
} as const;

export const VERSION_3_STORES = {
  ...VERSION_2_STORES,
  favorites: "id, &[entityType+entityId], createdAt",
} as const;

export const VERSION_4_STORES = {
  ...VERSION_3_STORES,
  savedViews: "id, entityType, name, updatedAt",
} as const;

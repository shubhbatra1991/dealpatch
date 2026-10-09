export type FavoriteEntityType = "account" | "contact" | "deal";

export interface FavoriteTarget {
  entityType: FavoriteEntityType;
  entityId: string;
}

/** References only; display information belongs to the referenced CRM record. */
export interface Favorite extends FavoriteTarget {
  id: string;
  createdAt: string;
}

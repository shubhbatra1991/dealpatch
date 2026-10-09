import type { Account } from "../accounts/account";
import type { Activity } from "../activities/activity";
import type { Contact } from "../contacts/contact";
import type { Deal } from "../deals/deal";

export type ChangeStatus = "Pending" | "Approved" | "Rejected" | "Edited";

// Proposals edit business fields, not record identities, relationships, or
// system-managed timestamps. Each entity keeps its own field/value types.
type ChangeableEntities = {
  Account: Omit<Account, "id" | "createdAt" | "updatedAt">;
  Contact: Omit<Contact, "id" | "accountId">;
  Deal: Omit<Deal, "id" | "accountId">;
  Activity: Omit<Activity, "id" | "accountId" | "dealId">;
};

export type ChangeEntityType = keyof ChangeableEntities;

// Optional fields use null in proposals to represent an absent/cleared value,
// so changes remain serializable without relying on undefined JSON properties.
type ChangeValue<T> = undefined extends T ? Exclude<T, undefined> | null : T;
type SnapshotValue<T> = T extends readonly (infer Item)[] ? readonly Item[] : T;

type EntityChange<Entity extends ChangeEntityType> = {
  [Field in keyof ChangeableEntities[Entity]]-?: {
    id: string;
    entityType: Entity;
    entityId: string;
    field: Field;
    /** Immutable generation-time snapshot. Editing a suggestion changes after only. */
    readonly before: SnapshotValue<ChangeValue<ChangeableEntities[Entity][Field]>>;
    after: ChangeValue<ChangeableEntities[Entity][Field]>;
    selected: boolean;
    status: ChangeStatus;
    /** Retained after approval/rejection; optional for existing stored proposals. */
    edited?: boolean;
  };
}[keyof ChangeableEntities[Entity]];

/** Discriminated by entityType and field to preserve field/value correlation. */
export type ProposalChange = {
  [Entity in ChangeEntityType]: EntityChange<Entity>;
}[ChangeEntityType];

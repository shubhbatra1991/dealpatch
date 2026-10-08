export type AccountStatus = "Prospect" | "Active" | "Customer" | "Dormant";

export interface Account {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  /** Non-negative employee count. */
  employeeCount?: number;
  region?: string;
  /** Demo ownership reference; does not imply an authenticated user. */
  ownerId: string;
  status: AccountStatus;
  /** ISO 8601 datetime. */
  createdAt: string;
  /** ISO 8601 datetime. */
  updatedAt: string;
}

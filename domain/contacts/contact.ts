// DATA_MODEL.md names ContactStatus but leaves its allowed values unspecified.
// Preserve the existing V1 lifecycle until that document defines otherwise.
export type ContactStatus = "Active" | "Inactive";

export interface Contact {
  id: string;
  accountId: string;
  firstName: string;
  lastName: string;
  role?: string;
  email?: string;
  phone?: string;
  status: ContactStatus;
}

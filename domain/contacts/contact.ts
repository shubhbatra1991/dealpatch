// Initial contact lifecycle; the product specification does not yet define it.
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

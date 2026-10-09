import type { Metadata } from "next";
import { ContactsWorkspace } from "@/features/contacts/contacts-workspace";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <ContactsWorkspace />;
}

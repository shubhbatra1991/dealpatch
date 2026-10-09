import type { Metadata } from "next";
import { ContactDetailWorkspace } from "@/features/contacts/contact-detail-workspace";

export const metadata: Metadata = { title: "Contact" };

export default async function Page({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  return <ContactDetailWorkspace key={contactId} contactId={contactId} />;
}

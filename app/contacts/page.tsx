import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <WorkspacePlaceholder title="Contacts" description="Keep track of the people behind your accounts." />;
}

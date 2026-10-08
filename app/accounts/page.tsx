import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return <WorkspacePlaceholder title="Accounts" description="Manage the companies you work with." />;
}

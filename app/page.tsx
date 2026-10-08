import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/layout/workspace-placeholder";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <WorkspacePlaceholder title="Overview" description="Your sales workspace at a glance." />;
}

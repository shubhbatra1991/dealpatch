import type { Metadata } from "next";
import { ActivityWorkspace } from "@/features/activity/activity-workspace";

export const metadata: Metadata = { title: "Activity" };

export default function Page() {
  return <ActivityWorkspace />;
}

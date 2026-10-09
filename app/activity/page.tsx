import type { Metadata } from "next";
import { ActivityWorkspace } from "@/features/activity/activity-workspace";

export const metadata: Metadata = { title: "Activity" };

export default async function Page({ searchParams }: { searchParams: Promise<{ activity?: string | string[] }> }) {
  const { activity } = await searchParams;
  const targetActivityId = typeof activity === "string" ? activity : undefined;
  return <ActivityWorkspace key={targetActivityId} targetActivityId={targetActivityId} />;
}

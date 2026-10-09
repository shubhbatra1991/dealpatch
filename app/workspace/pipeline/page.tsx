import type { Metadata } from "next";
import { PipelineWorkspace } from "@/features/pipeline/pipeline-workspace";

export const metadata: Metadata = { title: "Pipeline" };

export default async function Page({ searchParams }: { searchParams: Promise<{ deal?: string | string[]; view?: string | string[] }> }) {
  const { deal, view } = await searchParams;
  const targetDealId = typeof deal === "string" ? deal : undefined;
  const savedViewId = typeof view === "string" && view ? view : undefined;
  return <PipelineWorkspace key={JSON.stringify([targetDealId, savedViewId])} targetDealId={targetDealId} savedViewId={savedViewId} />;
}

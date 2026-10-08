import type { Metadata } from "next";
import { PipelineWorkspace } from "@/features/pipeline/pipeline-workspace";

export const metadata: Metadata = { title: "Pipeline" };

export default function Page() {
  return <PipelineWorkspace />;
}

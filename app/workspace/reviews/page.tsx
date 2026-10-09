import type { Metadata } from "next";
import { ReviewWorkspace } from "@/features/reviews/review-workspace";

export const metadata: Metadata = { title: "Review Queue" };

export default async function Page({ searchParams }: { searchParams: Promise<{ proposal?: string | string[] }> }) {
  const { proposal } = await searchParams;
  const targetProposalId = typeof proposal === "string" ? proposal : undefined;
  return <ReviewWorkspace key={targetProposalId} targetProposalId={targetProposalId} />;
}

import type { Metadata } from "next";
import { ReviewHistory } from "@/features/reviews/review-history";

export const metadata: Metadata = { title: "Review History" };

export default async function Page({ searchParams }: { searchParams: Promise<{ proposal?: string | string[] }> }) {
  const { proposal } = await searchParams;
  return <ReviewHistory targetProposalId={typeof proposal === "string" ? proposal : undefined} />;
}

import type { Metadata } from "next";
import { ReviewWorkspace } from "@/features/reviews/review-workspace";

export const metadata: Metadata = { title: "Review Queue" };

export default function Page() {
  return <ReviewWorkspace />;
}

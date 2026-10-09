import type { Metadata } from "next";
import { DealDetailWorkspace } from "../../../../features/deals/deal-detail-workspace";

export const metadata: Metadata = { title: "Deal" };

export default async function Page({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  return <DealDetailWorkspace key={dealId} dealId={dealId} />;
}

import type { Metadata } from "next";
import { AccountDetailWorkspace } from "@/features/accounts/account-detail-workspace";

export const metadata: Metadata = { title: "Account" };

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return <AccountDetailWorkspace key={accountId} accountId={accountId} />;
}

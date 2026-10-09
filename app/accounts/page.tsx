import type { Metadata } from "next";
import { AccountsWorkspace } from "@/features/accounts/accounts-workspace";

export const metadata: Metadata = { title: "Accounts" };

export default function Page() {
  return <AccountsWorkspace />;
}

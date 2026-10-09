import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import "@/features/landing/landing.css";

const title = "DealPatch — Human-Reviewed Sales Automation";
const description = "An open-source, local-first B2B sales workspace exploring transparent, human-reviewed CRM automation.";
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  openGraph: { title, description, siteName: "DealPatch", type: "website" },
  twitter: { card: "summary", title, description },
};

export default function Page() {
  return <LandingPage />;
}

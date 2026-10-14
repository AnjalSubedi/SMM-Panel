import type { Metadata } from "next";
import AccountDashboard from "../../components/AccountDashboard";
import { requireUserPage } from "../../lib/server/access";
import { accountData } from "../../lib/server/commerce";
import { services } from "../../lib/services";
export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ resume?: string }> }) {
  const user = await requireUserPage();
  const query = await searchParams;
  return <AccountDashboard services={services} initial={await accountData(user)} resumeCheckout={query.resume === "1"} />;
}

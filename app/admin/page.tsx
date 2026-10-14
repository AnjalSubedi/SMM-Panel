import type { Metadata } from "next";
import AdminDashboard from "../../components/AdminDashboard";
import { requireUserPage } from "../../lib/server/access";
import { adminData } from "../../lib/server/commerce";
export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AdminPage() {
  const user = await requireUserPage(true);
  return <AdminDashboard initial={await adminData(user.id)} />;
}

import AdminDashboard from "../../components/AdminDashboard";
import { requireUserPage } from "../../lib/server/access";
import { adminData } from "../../lib/server/commerce";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function AdminPage() {
  const user = await requireUserPage(true);
  return <AdminDashboard initial={adminData(user.id)} />;
}

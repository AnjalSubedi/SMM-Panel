import type { Metadata } from "next";
import AccountSettings from "../../../components/AccountSettings";
import { requireUserPage } from "../../../lib/server/access";
import { getAuth } from "../../../lib/server/auth";
export const metadata: Metadata = { title: "Profile settings" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function SettingsPage() {
  const user = await requireUserPage(false, "/account/settings");
  const auth = await getAuth();
  return <AccountSettings user={user} resetEnabled={Boolean(auth.options.emailAndPassword?.sendResetPassword)} />;
}

import Link from "next/link";
import NotificationCenter from "../../../components/NotificationCenter";
import { requireUserPage } from "../../../lib/server/access";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function NotificationsPage() {
  await requireUserPage(false, "/account/notifications");
  return <div className="page-container py-10 sm:py-14"><Link href="/account" className="text-xs font-semibold text-blue-600">&larr; Back to dashboard</Link><p className="eyebrow mt-7">Your account</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Notifications</h1><div className="mt-8 max-w-3xl"><NotificationCenter /></div></div>;
}

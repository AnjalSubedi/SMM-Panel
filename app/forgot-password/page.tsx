import { privateRobots } from "../../lib/seo";
import type { Metadata } from "next";
import AuthPage from "../../components/AuthPage";
export const metadata: Metadata = { title: "Reset password", robots: privateRobots };
export const dynamic = "force-dynamic";
export default function ForgotPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { return <AuthPage mode="forgot" params={searchParams} />; }

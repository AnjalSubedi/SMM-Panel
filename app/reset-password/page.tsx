import { privateRobots } from "../../lib/seo";
import type { Metadata } from "next";
import AuthPage from "../../components/AuthPage";
export const metadata: Metadata = { title: "New password", robots: privateRobots };
export const dynamic = "force-dynamic";
export default function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { return <AuthPage mode="reset" params={searchParams} />; }

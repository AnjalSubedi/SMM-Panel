import type { Metadata } from "next";
import AuthPage from "../../components/AuthPage";
export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";
export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) { return <AuthPage mode="login" params={searchParams} />; }

import AuthPage from "../../components/AuthPage";
export const dynamic = "force-dynamic";
export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) { return <AuthPage mode="login" params={searchParams} />; }

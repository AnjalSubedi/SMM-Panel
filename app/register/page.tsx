import AuthPage from "../../components/AuthPage";
export const dynamic = "force-dynamic";
export default function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { return <AuthPage mode="register" params={searchParams} />; }

import AuthPage from "../../components/AuthPage";
export const dynamic = "force-dynamic";
export default function ForgotPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) { return <AuthPage mode="forgot" params={searchParams} />; }

import AuthPage from "../../components/AuthPage";
export const dynamic = "force-dynamic";
export default function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { return <AuthPage mode="reset" params={searchParams} />; }

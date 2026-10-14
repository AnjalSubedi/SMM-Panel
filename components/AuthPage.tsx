import { redirect } from "next/navigation";
import AuthForm from "./AuthForm";
import { currentUser } from "../lib/server/access";
import { getAuth } from "../lib/server/auth";
import { safeNext } from "../lib/navigation";

export default async function AuthPage({ mode, params }: { mode: "login" | "register" | "forgot" | "reset"; params: Promise<{ next?: string; token?: string; error?: string }> }) {
  const query = await params;
  const next = safeNext(query.next);
  if ((mode === "login" || mode === "register") && await currentUser()) redirect(next);
  const auth = await getAuth();
  const googleConfigured = Boolean(auth.options.socialProviders?.google);
  const emailConfigured = Boolean(auth.options.emailAndPassword?.sendResetPassword);
  return <AuthForm mode={mode} next={next} token={query.token} googleEnabled={googleConfigured} emailEnabled={mode === "login" || emailConfigured} resetEnabled={emailConfigured} initialError={query.error ? "Google sign-in could not be completed. Please try again." : undefined} />;
}

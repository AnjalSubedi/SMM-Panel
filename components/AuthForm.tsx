"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { authClient } from "../lib/auth-client";

type Mode = "login" | "register" | "forgot" | "reset";
export default function AuthForm({ mode, next, token, googleEnabled, emailEnabled, resetEnabled, initialError }: { mode: Mode; next: string; token?: string; googleEnabled: boolean; emailEnabled: boolean; resetEnabled: boolean; initialError?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [verifyNeeded, setVerifyNeeded] = useState(false);
  const [message, setMessage] = useState("");
  const registering = mode === "register";
  const title = mode === "forgot" ? "Reset your password" : mode === "reset" ? "Choose a new password" : registering ? "Create your account" : "Welcome back";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setMessage("");
    try {
      if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
        if (result.error) throw new Error(result.error.message || "Unable to request a reset.");
        setMessage("If this email has an account, a password reset link is on its way.");
      } else if (mode === "reset") {
        const result = await authClient.resetPassword({ newPassword: password, token: token || "" });
        if (result.error) throw new Error(result.error.message || "This reset link is invalid or expired.");
        setMessage("Your password has been updated. You can now sign in.");
      } else {
        const result = registering
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: next })
          : await authClient.signIn.email({ email: email.trim(), password, callbackURL: next, rememberMe: true });
        if (result.error) { if (result.error.code === "EMAIL_NOT_VERIFIED") setVerifyNeeded(true); throw new Error(result.error.message || "Unable to sign in. Please try again."); }
        const session = await authClient.getSession();
        if (session.data) window.location.assign(next);
        else setMessage("Check your inbox to verify your email, then sign in.");
      }
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Something went wrong. Please try again."); }
    finally { setPending(false); }
  }

  async function google() {
    setPending(true); setError("");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: next, errorCallbackURL: "/login?error=google&next=" + encodeURIComponent(next) });
      if (result.error) throw new Error(result.error.message || "Google sign-in failed.");
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Please try signing in again."); setPending(false); }
  }

  return (
    <section className="page-container py-12 sm:py-20">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className="hidden lg:block">
          <p className="eyebrow">Your orders and payments</p>
          <h2 className="mt-5 text-4xl font-bold leading-[1.15] tracking-tight text-slate-900">Keep track of your orders.<br /><span className="text-blue-600">All in one account.</span></h2>
          <p className="mt-6 max-w-sm text-base leading-8 text-slate-600">See your order progress, add money to your wallet and check your payment history.</p>
          <div className="mt-8 space-y-4 text-sm text-slate-600"><p className="flex items-center gap-3"><ShieldCheck size={18} className="text-emerald-600" aria-hidden="true" />Pay per order or use your wallet</p><p className="flex items-center gap-3"><LockKeyhole size={18} className="text-blue-600" aria-hidden="true" />We never ask for social account passwords</p></div>
        </div>
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><LockKeyhole size={21} aria-hidden="true" /></span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{registering ? "Start with email or your Google account." : mode === "login" ? "Sign in to your orders and account wallet." : mode === "forgot" ? "We will email you a secure reset link." : "Use at least 10 characters for your new password."}</p>
          {(mode === "login" || registering) && <>
            <button type="button" disabled={!googleEnabled || pending} onClick={google} className="button-secondary mt-6 min-h-12 w-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.4 13.92A6 6 0 0 1 6.09 12c0-.67.11-1.32.31-1.92V7.49H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.51l3.35-2.59Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.88-2.87A9.58 9.58 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.35 2.59A5.98 5.98 0 0 1 12 5.95Z" /></svg>
              Continue with Google
            </button>
            {!googleEnabled && <p className="mt-2 text-center text-xs text-slate-500">Google sign-in is unavailable right now. Try signing in with email.</p>}
            <div className="my-5 flex items-center gap-3 text-[11px] text-slate-400"><span className="h-px flex-1 bg-slate-200" />or continue with email<span className="h-px flex-1 bg-slate-200" /></div>
          </>}
          <form onSubmit={submit} className="space-y-4">
            {registering && <div><label htmlFor="auth-name" className="text-xs font-semibold text-slate-700">Full name</label><input id="auth-name" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="field-input" placeholder="Your name" /></div>}
            {mode !== "reset" && <div><label htmlFor="auth-email" className="text-xs font-semibold text-slate-700">Email address</label><input id="auth-email" required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field-input" placeholder="you@example.com" /></div>}
            {mode !== "forgot" && <div><div className="flex items-center justify-between"><label htmlFor="auth-password" className="text-xs font-semibold text-slate-700">Password</label>{mode === "login" && <a href="/forgot-password" className="text-xs font-semibold text-blue-600">Forgot password?</a>}</div><div className="relative"><input id="auth-password" required type={visible ? "text" : "password"} minLength={mode === "login" ? 1 : 10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="field-input pr-12" placeholder={mode === "login" ? "Enter your password" : "At least 10 characters"} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} className="absolute right-1 top-0 flex size-11 items-center justify-center text-slate-400">{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>}
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>}
            {verifyNeeded && resetEnabled && <button type="button" disabled={pending || !email} onClick={async () => { setPending(true); setError(""); try { const result = await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: next }); if (result.error) throw new Error(result.error.message || "Unable to send verification email."); setMessage("Verification email sent. Please check your inbox."); } catch (issue) { setError((issue as Error).message); } finally { setPending(false); } }} className="text-xs font-semibold text-blue-600">Resend verification email</button>}
            {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-700">{message}</p>}
            {!emailEnabled && (mode === "register" || mode === "login") && <p className="text-xs leading-5 text-amber-700">Signing in with email is unavailable right now. Try Google instead.</p>}
            {mode === "forgot" && !resetEnabled && <p className="text-xs leading-5 text-amber-700">Password reset is unavailable right now. Contact us for help signing in.</p>}
            <button disabled={pending || ((mode === "login" || registering) && !emailEnabled) || (mode === "forgot" && !resetEnabled) || (mode === "reset" && !token)} className="button-primary min-h-12 w-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40">{pending ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : registering ? "Create account" : "Sign in"}<ArrowRight size={16} aria-hidden="true" /></button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">{mode === "login" ? <>New here? <a className="font-semibold text-blue-600" href={"/register?next=" + encodeURIComponent(next)}>Create an account</a></> : registering ? <>Already have an account? <a className="font-semibold text-blue-600" href={"/login?next=" + encodeURIComponent(next)}>Sign in</a></> : <a href="/login" className="font-semibold text-blue-600">Back to sign in</a>}</p>
          <p className="mt-5 text-center text-[10px] leading-5 text-slate-400"><Mail size={11} className="mr-1 inline" aria-hidden="true" />Your wallet and order history stay with your account.</p>
        </div>
      </div>
    </section>
  );
}

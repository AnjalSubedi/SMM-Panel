"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { authClient } from "../lib/auth-client";
import type { AccountUser } from "../lib/account-types";
import UserAvatar from "./UserAvatar";
import { site } from "../config/site";
export default function AccountSettings({ user, resetEnabled }: { user: AccountUser; resetEnabled: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try { const result = await authClient.updateUser({ name: name.trim() }); if (result.error) throw new Error(result.error.message || "Unable to save your profile."); setSaved(true); router.refresh(); }
    catch (issue) { setError((issue as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="page-container py-10 sm:py-14"><a href="/account" className="text-xs font-semibold text-blue-600">&larr; Back to dashboard</a><p className="eyebrow mt-7">Your account</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Profile settings</h1><p className="mt-2 text-sm leading-7 text-slate-500">Manage the name shown on your account and check your sign-in details.</p>
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><div className="flex items-center gap-4"><UserAvatar id={user.id} name={name} className="size-14 text-lg" /><div><h2 className="text-base font-bold">Your profile</h2><p className="mt-1 text-xs leading-6 text-slate-500">Your name and initials appear in your profile menu.</p></div></div><div className="mt-6"><label htmlFor="profile-name" className="text-xs font-semibold text-slate-700">Display name</label><input id="profile-name" value={name} onChange={event => { setName(event.target.value); setSaved(false); }} required minLength={2} maxLength={80} autoComplete="name" className="field-input" /></div><div className="mt-5"><p className="text-xs font-semibold text-slate-700">Sign-in email</p><p className="mt-2 flex items-start gap-2 break-all rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><Mail size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{user.email}</p><p className="mt-2 text-xs leading-6 text-slate-500">You use this email to sign in. Contact us if you need to change it.</p></div>{error && <p role="alert" className="mt-4 text-xs leading-6 text-red-700">{error}</p>}{saved && <p role="status" className="mt-4 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={15} aria-hidden="true" />Profile updated.</p>}<button disabled={busy || name.trim().length < 2 || name.trim() === user.name} className="button-primary mt-5 min-h-11 px-5 text-sm disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button></form>
    <aside className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><ShieldCheck size={23} className="text-blue-600" aria-hidden="true" /><h2 className="mt-4 text-base font-bold">Sign-in details</h2><p className="mt-3 text-xs leading-6 text-slate-500">Email status: <span className="font-semibold text-slate-700">{user.emailVerified ? "Verified" : "Not verified"}</span></p><p className="mt-3 text-xs leading-6 text-slate-500">Google users manage their password through Google. If you use an email password, you can request a reset from the sign-in page.</p>{resetEnabled && <a href="/forgot-password" className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-blue-600">Reset password<ArrowUpRight size={14} /></a>}<div className="mt-5 border-t border-slate-100 pt-5"><p className="text-xs leading-6 text-slate-500">Need help with account access, a payment, or an order?</p><a href={"https://wa.me/" + site.whatsappNumber} className="button-secondary mt-3 min-h-10 px-4 text-xs">Contact support<ArrowUpRight size={14} /></a></div></aside></div>
  </section>;
}

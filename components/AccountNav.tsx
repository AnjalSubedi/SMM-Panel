"use client";
import { LogIn, UserRound } from "lucide-react";
import { authClient } from "../lib/auth-client";

export default function AccountNav() {
  const { data, isPending } = authClient.useSession();
  if (isPending) return <span className="h-10 w-20 animate-pulse rounded-lg bg-slate-100" aria-label="Loading account" />;
  return <a href={data ? "/account" : "/login"} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:text-[13px]">{data ? <UserRound size={15} aria-hidden="true" /> : <LogIn size={15} aria-hidden="true" />}{data ? "Account" : "Sign in"}</a>;
}

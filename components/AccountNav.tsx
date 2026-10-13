"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Bell, ChevronDown, CircleHelp, CreditCard, LayoutDashboard, LogIn, LogOut, Settings, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { useAccount } from "./AccountProvider";
import UserAvatar from "./UserAvatar";
import NotificationBell from "./NotificationBell";
import { site } from "../config/site";

export default function AccountNav() {
  const { session, sessionPending, notifications } = useAccount();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => { setOpen(false); setError(""); setBusy(false); }, [session?.user.id]);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); return; }
    if (event.key === "Tab") { setOpen(false); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') || []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
  async function signOut() {
    setBusy(true); setError("");
    try { const result = await authClient.signOut(); if (result.error) throw new Error(); window.location.assign("/login"); }
    catch { setError("Unable to sign out. Please try again."); setBusy(false); }
  }
  if (sessionPending) return <span className="h-10 w-20 animate-pulse rounded-lg bg-slate-100" aria-label="Loading account" />;
  if (!session) return <a href="/login" className="button-secondary min-h-10 shrink-0 px-3 text-xs sm:text-[13px]"><LogIn size={15} aria-hidden="true" />Sign in</a>;
  const links = [
    { label: "Dashboard", href: "/account", icon: LayoutDashboard },
    { label: "Place an order", href: "/account#new-order", icon: ShoppingBag },
    { label: "Browse services", href: "/services#calculator", icon: ShoppingBag },
    { label: "My orders", href: "/account#orders", icon: ShoppingBag },
    { label: "Add funds", href: "/account#add-funds", icon: Wallet },
    { label: "Payment history", href: "/account#payments", icon: CreditCard },
    { label: "Notifications", href: "/account/notifications", icon: Bell },
    { label: "Profile settings", href: "/account/settings", icon: Settings },
    { label: "Help & support", href: "https://wa.me/" + site.whatsappNumber, icon: CircleHelp },
    ...(notifications?.isAdmin ? [{ label: "Admin panel", href: "/admin", icon: ShieldCheck }] : []),
  ];
  const unread = notifications?.unreadCount || 0;
  return <div ref={wrapper} className="relative flex shrink-0 items-center gap-2">
    <NotificationBell onOpen={() => setOpen(false)} />
    <button ref={trigger} type="button" aria-label={"Open profile menu for " + session.user.name} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)} onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }} className="flex items-center gap-1.5 rounded-lg border border-transparent p-0.5 hover:border-slate-200 hover:bg-slate-50"><UserAvatar id={session.user.id} name={session.user.name} /><ChevronDown size={13} className={"hidden text-slate-500 transition-transform sm:block " + (open ? "rotate-180" : "")} aria-hidden="true" /></button>
    {open && <div ref={menu} id={menuId} role="menu" aria-label="Profile menu" onKeyDown={keyboard} className="absolute right-0 top-[calc(100%+0.75rem)] z-60 max-h-[calc(100dvh-7rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      <div role="presentation" className="mb-1 border-b border-slate-100 px-3 py-3"><p className="truncate text-sm font-bold text-slate-900">{session.user.name}</p><p className="mt-1 break-all text-xs leading-5 text-slate-500">{session.user.email}</p></div>
      {links.map(({ label, href, icon: Icon }) => <a role="menuitem" tabIndex={-1} key={label} href={href} target={href.startsWith("https:") ? "_blank" : undefined} rel={href.startsWith("https:") ? "noopener noreferrer" : undefined} onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-blue-50 focus:text-blue-700"><Icon size={17} className="shrink-0 text-slate-400" aria-hidden="true" /><span>{label}</span>{label === "Notifications" && unread > 0 && <span className="ml-auto rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">{unread}</span>}</a>)}
      <div role="presentation" className="mt-1 border-t border-slate-100 pt-1"><button role="menuitem" tabIndex={-1} type="button" disabled={busy} onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 focus:bg-red-50 disabled:opacity-50"><LogOut size={17} aria-hidden="true" />{busy ? "Signing out..." : "Sign out"}</button></div>
      {error && <p role="alert" className="px-3 py-2 text-xs leading-5 text-red-700">{error}</p>}
    </div>}
  </div>;
}

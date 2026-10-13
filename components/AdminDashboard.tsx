"use client";

import { useState } from "react";
import { ArrowUpRight, RefreshCw, ShieldCheck } from "lucide-react";
import type { AdminData } from "../lib/account-types";
import { formatPrice } from "../lib/catalog";
import OrderDeliveryDetails from "./OrderDeliveryDetails";
import StatusBadge from "./StatusBadge";

type Payment = AdminData["payments"][number];

function PaymentReview({ payment, reviewed }: { payment: Payment; reviewed: () => Promise<void> }) {
  const [confirmed, setConfirmed] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(decision: "approve" | "reject") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: payment.id, decision, confirmedReceived: confirmed, note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Review failed.");
      await reviewed();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">{payment.kind === "topup" ? "Wallet deposit" : "Direct order payment"}</p><p className="mt-1 break-all text-sm font-bold">{payment.email}</p></div><div className="text-right"><p className="mb-2 font-mono text-lg font-bold">{formatPrice(payment.amountPaisa / 100)}</p><StatusBadge status={payment.status} /></div></div>
    {payment.itemName && <p className="mt-3 text-xs leading-6 text-slate-600">{payment.itemName}</p>}
    <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-[10px] text-slate-500">eSewa reference - verify against your merchant statement</p><p className="mt-1 break-all font-mono text-sm font-bold text-slate-800">{payment.reference}</p></div>
    {payment.status === "pending" ? <div className="mt-4"><label className="flex items-start gap-2 text-xs leading-6 text-slate-600"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-blue-600" />I verified the payer, reference and exact amount in eSewa.</label><label className="mt-3 block text-xs font-semibold text-slate-700" htmlFor={"note-" + payment.id}>Review note</label><input id={"note-" + payment.id} value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={1000} placeholder="Verified amount and reference, or reason for rejection" className="field-input" /><div className="mt-3 flex gap-2"><button type="button" disabled={busy || !confirmed || note.trim().length < 5} onClick={() => review("approve")} className="button-primary min-h-10 px-4 text-xs disabled:opacity-40">{busy ? "Saving..." : payment.kind === "topup" ? "Approve & credit wallet" : "Approve payment"}</button><button type="button" disabled={busy || note.trim().length < 5} onClick={() => review("reject")} className="button-secondary min-h-10 px-4 text-xs disabled:opacity-40">Reject</button></div>{error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}</div> : <p className="mt-3 text-xs leading-6 text-slate-500">{payment.note}</p>}
  </article>;
}

export default function AdminDashboard({ initial }: { initial: AdminData }) {
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState<"payments" | "orders" | "users" | "audit">("payments");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});
  const [scheduleConfirmed, setScheduleConfirmed] = useState<Record<string, boolean>>({});
  async function refresh() {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load admin data. Check your session.");
    setData(await response.json());
  }
  async function reload() { setBusy(true); setError(""); try { await refresh(); } catch (issue) { setError((issue as Error).message); } finally { setBusy(false); } }
  async function status(orderId: string, next: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, status: next, note: orderNotes[orderId] || "", scheduleConfirmed: Boolean(scheduleConfirmed[orderId]) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to update order.");
      await refresh();
    } catch (issue) { setError((issue as Error).message); } finally { setBusy(false); }
  }
  const metrics = [{ label: "Registered accounts", value: String(data.totals.users) }, { label: "Payments to review", value: String(data.totals.pendingPayments) }, { label: "Active paid orders", value: String(data.totals.queuedOrders) }, { label: "Wallet balance liability", value: formatPrice(data.totals.walletLiabilityPaisa / 100) }];
  return <section className="page-container py-10 sm:py-14">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow flex items-center gap-2"><ShieldCheck size={14} />Administrator</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Operations dashboard</h1><p className="mt-2 text-sm text-slate-500">Verify payments, manage delivery, and review account activity.</p></div><div className="flex gap-2"><a href="/account" className="button-secondary min-h-10 px-3 text-xs">My account<ArrowUpRight size={14} /></a><button disabled={busy} onClick={reload} className="button-secondary min-h-10 px-3 text-xs"><RefreshCw size={14} />Refresh</button></div></div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-slate-500">{metric.label}</p><p className="mt-4 font-mono text-2xl font-bold text-slate-900">{metric.value}</p></div>)}</div>
    <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800">Payment references are customer claims. Confirm funds in your merchant eSewa account before approving. Orders enter the delivery queue after payment; provider dispatch is currently handled manually.</p>
    <div aria-label="Admin sections" className="mt-7 flex flex-wrap gap-2">{(["payments", "orders", "users", "audit"] as const).map((name) => <button type="button" key={name} aria-pressed={tab === name} onClick={() => setTab(name)} className={"rounded-lg border px-4 py-2.5 text-xs font-semibold capitalize " + (tab === name ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600")}>{name === "audit" ? "Audit log" : name}</button>)}</div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <div className="mt-6">
      {tab === "payments" && <div className="grid items-start gap-4 lg:grid-cols-2">{data.payments.map((payment) => <PaymentReview key={payment.id} payment={payment} reviewed={refresh} />)}{!data.payments.length && <p className="text-sm text-slate-500">No payment submissions yet.</p>}</div>}
      {tab === "orders" && <div className="space-y-4">{data.orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-mono text-[10px] text-slate-400">#{order.id}</p><h2 className="mt-2 text-sm font-bold">{order.itemName}</h2><p className="mt-2 break-all text-xs text-slate-500">{order.email} &middot; {order.quantity.toLocaleString()} units &middot; {order.method}</p></div><div className="text-right"><p className="mb-2 font-mono font-bold">{formatPrice(order.amountPaisa / 100)}</p><StatusBadge status={order.status} /></div></div><ul className="mt-3 space-y-1">{(JSON.parse(order.links) as { platform: string; url: string }[]).map((link) => <li key={link.platform} className="break-all text-xs text-blue-600"><a href={link.url} target="_blank" rel="noopener noreferrer">{link.platform}: {link.url}</a></li>)}</ul>{order.status === "awaiting_delivery" ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">Paid. Waiting for the customer to choose delivery timing in their account. Do not dispatch yet.</p> : ["queued", "processing", "completed"].includes(order.status) ? <OrderDeliveryDetails minutes={order.deliveryWindowMinutes} value={order.deliveryPlan} admin /> : null}{["queued", "processing"].includes(order.status) && <div className="mt-4">{order.deliveryWindowMinutes > 0 && <label className="mb-3 flex items-start gap-2 text-xs leading-6 text-slate-600"><input type="checkbox" checked={Boolean(scheduleConfirmed[order.id])} onChange={(event) => setScheduleConfirmed({ ...scheduleConfirmed, [order.id]: event.target.checked })} className="mt-1 accent-blue-600" />I configured the customer’s batch quantity, runs and interval with the provider.</label>}<label htmlFor={"order-note-" + order.id} className="text-xs font-semibold text-slate-700">Delivery note / provider order reference</label><input id={"order-note-" + order.id} maxLength={1000} value={orderNotes[order.id] || ""} onChange={(event) => setOrderNotes({ ...orderNotes, [order.id]: event.target.value })} className="field-input" placeholder="Record the provider reference or completion details" /><div className="mt-3 flex gap-2">{order.status === "queued" && <button disabled={busy || (orderNotes[order.id] || "").trim().length < 3 || (order.deliveryWindowMinutes > 0 && !scheduleConfirmed[order.id])} onClick={() => status(order.id, "processing")} className="button-secondary min-h-10 px-3 text-xs disabled:opacity-40">Mark processing</button>}<button disabled={busy || (orderNotes[order.id] || "").trim().length < 3 || (order.deliveryWindowMinutes > 0 && !scheduleConfirmed[order.id])} onClick={() => status(order.id, "completed")} className="button-primary min-h-10 px-3 text-xs disabled:opacity-40">Mark completed</button></div></div>}</article>)}{!data.orders.length && <p className="text-sm text-slate-500">No orders yet.</p>}</div>}
      {tab === "users" && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Account</th><th className="p-4">Email</th><th className="p-4">Verified</th><th className="p-4">Wallet</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id} className="border-t border-slate-100"><td className="p-4 font-semibold">{user.name}</td><td className="p-4">{user.email}</td><td className="p-4">{user.emailVerified ? "Yes" : "No"}</td><td className="whitespace-nowrap p-4 font-mono">{formatPrice(user.balancePaisa / 100)}</td></tr>)}</tbody></table></div>}
      {tab === "audit" && <div className="space-y-3">{data.audit.map((entry) => <article key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-bold">{entry.action.replaceAll("_", " ")}</p><p className="mt-2 text-xs text-slate-600">{entry.note}</p><p className="mt-2 break-all text-[10px] text-slate-400">{entry.actorEmail} &middot; {entry.createdAt} &middot; {entry.targetId}</p></article>)}{!data.audit.length && <p className="text-sm text-slate-500">Admin actions will be recorded here.</p>}</div>}
    </div><p className="mt-6 text-[10px] text-slate-400">Showing the latest 100 records per section.</p>
  </section>;
}

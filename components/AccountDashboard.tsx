"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Plus, RefreshCw, Wallet } from "lucide-react";
import { formatPrice } from "../lib/catalog";
import type { AccountData } from "../lib/account-types";
import StatusBadge from "./StatusBadge";
import PaymentQr from "./PaymentQr";
import DeliveryChoice from "./DeliveryChoice";
import OrderDeliveryDetails from "./OrderDeliveryDetails";
import AccountActions from "./AccountActions";

function date(value: string) { return new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Katmandu", dateStyle: "medium", timeStyle: "short" }); }

export default function AccountDashboard({ initial, resumeCheckout = false }: { initial: AccountData; resumeCheckout?: boolean }) {
  const [data, setData] = useState(initial);
  const [amount, setAmount] = useState("500");
  const [reference, setReference] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/login?next=/account"); return; }
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch { setError("Unable to refresh your account. Please try again."); }
    finally { setRefreshing(false); }
  }

  const awaitingPayment = data.orders.some((order) => order.status === "awaiting_payment");
  useEffect(() => {
    if (!awaitingPayment) return;
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => clearInterval(timer);
    // Only poll while a payment is pending; choices remain local until confirmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPayment]);

  async function addFunds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const key = requestKey || crypto.randomUUID(); setRequestKey(key);
    try {
      const response = await fetch("/api/account/topups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), reference: reference.trim(), requestKey: key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Deposit could not be submitted.");
      setMessage("Deposit submitted for review. Your wallet will be credited after the payment is verified.");
      setReference(""); setRequestKey("");
      await refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to submit this deposit."); }
    finally { setBusy(false); }
  }

  return <section className="page-container py-10 sm:py-14">
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="eyebrow">Your account</p><h1 className="mt-3 text-3xl font-bold tracking-tight">Welcome, {data.user.name.split(" ")[0]}.</h1><p className="mt-2 text-sm text-slate-500">{data.user.email}</p></div><div className="flex items-start gap-3">{data.user.isAdmin && <a href="/admin" className="button-primary min-h-10 px-3 text-xs">Admin panel<ArrowRight size={14} /></a>}<AccountActions /></div></div>
    {resumeCheckout && <a href="/?resumeOrder=1#calculator" className="button-secondary mt-5 min-h-11 px-4 text-sm">Return to your saved checkout<ArrowRight size={15} /></a>}
    <div className="mt-8 grid gap-5 md:grid-cols-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6"><div className="flex items-center justify-between text-sm font-semibold text-slate-700"><span>Available wallet balance</span><Wallet size={20} className="text-blue-600" /></div><p className="mt-5 font-mono text-3xl font-bold text-blue-600">{formatPrice(data.balancePaisa / 100)}</p><a href="#add-funds" className="button-primary mt-5 min-h-10 px-4 text-xs"><Plus size={14} />Add funds</a></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-700">Recent orders</p><p className="mt-5 font-mono text-3xl font-bold">{data.orders.length}</p><a href="/#calculator" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-blue-600">Create a new order<ArrowRight size={14} /></a></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-700">Deposits under review</p><p className="mt-5 font-mono text-3xl font-bold">{data.payments.filter((payment) => payment.kind === "topup" && payment.status === "pending").length}</p><button type="button" disabled={refreshing} onClick={refresh} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-blue-600"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />{refreshing ? "Refreshing..." : "Refresh account"}</button></div>
    </div>
    {(error || message) && <p role={error ? "alert" : "status"} className={"mt-5 rounded-lg border p-4 text-sm leading-6 " + (error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{error || message}</p>}
    <div className="mt-10 grid items-start gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Order history</h2><p className="mt-1 text-xs leading-6 text-slate-500">Wallet and direct-payment orders appear together. Showing the latest 100.</p>
        <div className="mt-5 space-y-3">{data.orders.length ? data.orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[10px] text-slate-400">#{order.id.slice(0, 8)}</span><StatusBadge status={order.status} /></div><h3 className="mt-3 text-sm font-bold leading-6">{order.itemName}</h3><div className="mt-3 flex justify-between gap-3 text-xs text-slate-500"><span>{order.quantity.toLocaleString()} units &middot; {order.method === "wallet" ? "Wallet" : "Direct eSewa"}</span><span className="font-mono font-bold text-slate-800">{formatPrice(order.amountPaisa / 100)}</span></div><p className="mt-2 text-[10px] text-slate-400">{date(order.createdAt)}</p>{order.status === "awaiting_delivery" && data.deliveryServices.find((service) => service.id === order.itemId) ? <DeliveryChoice orderId={order.id} service={data.deliveryServices.find((service) => service.id === order.itemId)!} quantity={order.quantity} onSaved={refresh} /> : order.status === "awaiting_payment" && data.deliveryServices.some((service) => service.id === order.itemId) ? <p className="mt-3 text-xs leading-6 text-blue-700">Delivery timing unlocks here after your payment is approved.</p> : ["queued", "processing", "completed"].includes(order.status) ? <OrderDeliveryDetails minutes={order.deliveryWindowMinutes} value={order.deliveryPlan} /> : null}</article>) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-500">Your first growth order starts here.</p><a href="/#calculator" className="mt-4 inline-block text-sm font-semibold text-blue-600">Explore the catalog</a></div>}</div>
      </div>
      <section id="add-funds" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="eyebrow">Account wallet</p><h2 className="mt-2 text-xl font-bold tracking-tight">Add funds with eSewa</h2><p className="mb-5 mt-2 text-xs leading-6 text-slate-500">Pay once, then use your balance for future orders. Deposits are credited after manual payment verification.</p><PaymentQr />
        <form onSubmit={addFunds} className="mt-5 space-y-4"><div><label htmlFor="deposit-amount" className="text-xs font-semibold text-slate-700">Amount paid (NPR)</label><input id="deposit-amount" required type="number" min="100" max="100000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="field-input font-mono" /><div className="mt-2 flex gap-2">{[500, 1000, 2500].map((value) => <button type="button" key={value} onClick={() => setAmount(String(value))} className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-[10px] text-slate-600">{formatPrice(value)}</button>)}</div></div><div><label htmlFor="deposit-reference" className="text-xs font-semibold text-slate-700">eSewa transaction reference</label><input id="deposit-reference" required minLength={6} maxLength={64} pattern="[a-zA-Z0-9-]+" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Reference from your payment receipt" className="field-input font-mono" /></div><button disabled={busy} className="button-primary min-h-12 w-full px-4 text-sm disabled:opacity-50">{busy ? "Submitting..." : "Submit deposit for review"}<ArrowRight size={16} /></button></form>
      </section>
    </div>
    <div className="mt-10 grid gap-7 lg:grid-cols-2"><section><h2 className="text-xl font-bold tracking-tight">Payment reviews</h2><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{data.payments.length ? data.payments.map((payment) => <div key={payment.id} className="border-b border-slate-100 p-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{payment.kind === "topup" ? "Wallet deposit" : "Order payment"} &middot; {formatPrice(payment.amountPaisa / 100)}</p><StatusBadge status={payment.status} /></div><p className="mt-2 break-all font-mono text-[10px] text-slate-500">{payment.reference}</p>{payment.note && <p className="mt-2 text-xs text-slate-600">{payment.note}</p>}</div>) : <p className="p-5 text-xs text-slate-500">No payments submitted yet.</p>}</div></section>
    <section><h2 className="text-xl font-bold tracking-tight">Wallet transactions</h2><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{data.ledger.length ? data.ledger.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-0"><div><p className="text-xs font-semibold">{entry.kind === "deposit" ? "Verified deposit" : "Order payment"}</p><p className="mt-1 text-[10px] text-slate-400">{date(entry.createdAt)}</p></div><p className={"font-mono text-sm font-bold " + (entry.amountPaisa > 0 ? "text-emerald-700" : "text-slate-800")}>{entry.amountPaisa > 0 ? "+" : "-"}{formatPrice(Math.abs(entry.amountPaisa) / 100)}</p></div>) : <p className="p-5 text-xs text-slate-500">Your confirmed credits and order deductions will appear here.</p>}</div></section></div>
  </section>;
}

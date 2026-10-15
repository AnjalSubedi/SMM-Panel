"use client";
import Link from "next/link";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Plus, RefreshCw, Wallet } from "lucide-react";
import { formatPrice } from "../lib/catalogFormat";
import type { CatalogItem } from "../lib/catalog";
import { checkoutPaths, checkoutReturnPath } from "../lib/checkoutNavigation";
import GrowthCatalog from "./GrowthCatalog";
import { customerItemName } from "../lib/customerCopy";
import type { AccountData } from "../lib/account-types";
import FulfillmentDetails from "./FulfillmentDetails";
import StatusBadge from "./StatusBadge";
import PaymentQr from "./PaymentQr";
import TermsAcceptance from "./TermsAcceptance";
import { termsAcceptance, type TermsLanguage } from "../lib/terms";
import DeliveryChoice from "./DeliveryChoice";
import OrderDeliveryDetails from "./OrderDeliveryDetails";
import UserAvatar from "./UserAvatar";
import NotificationCenter from "./NotificationCenter";
import { useAccount } from "./AccountProvider";

function date(value: string) { return new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Katmandu", dateStyle: "medium", timeStyle: "short" }); }

export default function AccountDashboard({ initial, services, resumeCheckout = false }: { initial: AccountData; services: CatalogItem[]; resumeCheckout?: boolean }) {
  const [savedCheckoutPath, setSavedCheckoutPath] = useState<string>(checkoutPaths.services);
  useEffect(() => {
    if (!resumeCheckout) return;
    try { const draft = JSON.parse(sessionStorage.getItem("dmnp-checkout-draft") || "null"); setSavedCheckoutPath(checkoutReturnPath(draft?.returnTo)); } catch { /* Invalid drafts keep the services-page fallback. */ }
  }, [resumeCheckout]);
  const [data, setData] = useState(initial);
  useEffect(() => { setData(initial); }, [initial]);
  const accountRequest = useRef<Promise<void> | null>(null);
  const accountController = useRef<AbortController | null>(null);
  useEffect(() => () => { accountController.current?.abort(); }, []);
  const { refreshNotifications } = useAccount();
  const walletPaymentRef = useRef<HTMLDivElement>(null);
  const [walletTermsAccepted, setWalletTermsAccepted] = useState(false);
  const [walletTermsLanguage, setWalletTermsLanguage] = useState<TermsLanguage>("en");
  const [walletPaymentReady, setWalletPaymentReady] = useState(false);
  const [amount, setAmount] = useState("500");
  const [reference, setReference] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (walletPaymentReady) {
      walletPaymentRef.current?.focus({ preventScroll: true });
      walletPaymentRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [walletPaymentReady]);

  function refresh(force = true): Promise<void> {
    if (accountRequest.current && !force) return accountRequest.current;
    if (force) accountController.current?.abort();
    const controller = new AbortController(); accountController.current = controller;
    setRefreshing(true);
    const request = (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.assign("/login?next=/account"); return; }
        if (!response.ok) throw new Error();
        const result: AccountData = await response.json();
        if (!controller.signal.aborted) { setData(result); void refreshNotifications(); }
      } catch { if (!controller.signal.aborted) setError("Unable to refresh your account. Please try again."); }
      finally { if (!controller.signal.aborted) setRefreshing(false); }
    })();
    accountRequest.current = request;
    void request.finally(() => { if (accountRequest.current === request) accountRequest.current = null; });
    return request;
  }

  const awaitingPayment = data.orders.some((order) => ["awaiting_payment", "queued", "submitting", "submitted", "processing"].includes(order.status)) || data.payments.some((payment) => payment.status === "pending");
  useEffect(() => {
    if (!awaitingPayment) return;
    const timer = setInterval(() => { if (!document.hidden) void refresh(false); }, 15000);
    return () => clearInterval(timer);
    // Poll pending payments and active deliveries; timing choices stay local until confirmed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingPayment]);

  async function addFunds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!walletTermsAccepted) { setError("Please read and accept the wallet terms before payment."); return; }
    if (!walletPaymentReady) { if (event.currentTarget.reportValidity()) { setWalletPaymentReady(true); setError(""); setMessage(""); } return; }
    setBusy(true); setError(""); setMessage("");
    const key = requestKey || crypto.randomUUID(); setRequestKey(key);
    try {
      const response = await fetch("/api/account/topups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), reference: reference.trim(), requestKey: key, ...termsAcceptance(walletTermsLanguage) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Deposit could not be submitted.");
      setMessage("Payment details received. We’ll add the money to your wallet once our team checks the payment.");
      setReference(""); setRequestKey(""); setWalletTermsAccepted(false); setWalletPaymentReady(false);
      await refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to submit this deposit."); }
    finally { setBusy(false); }
  }

  return <section className="page-container py-10 sm:py-14">
    <div className="flex flex-wrap items-start justify-between gap-5"><div className="flex min-w-0 items-center gap-4"><span className="hidden sm:inline-flex"><UserAvatar id={data.user.id} name={data.user.name} className="size-14 text-lg" /></span><div className="min-w-0"><p className="eyebrow">Your account</p><h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">Welcome, {data.user.name.trim().split(/\s+/)[0]}.</h1><p className="mt-2 break-all text-sm text-slate-500">{data.user.email}</p></div></div><div className="flex flex-wrap gap-2"><a href="#new-order" className="button-primary min-h-11 px-4 text-xs">Create a new order<ArrowRight size={14} aria-hidden="true" /></a><button type="button" disabled={refreshing} onClick={() => void refresh()} className="button-secondary min-h-11 px-3 text-xs disabled:opacity-50"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />{refreshing ? "Refreshing..." : "Refresh account"}</button></div></div>
    <nav aria-label="Account sections" className="mt-7 flex flex-wrap gap-2 border-b border-slate-200 pb-4">{[{ label: "Place an order", href: "#new-order" }, { label: "My orders", href: "#orders" }, { label: "Add funds", href: "#add-funds" }, { label: "Payment history", href: "#payments" }, { label: "Transactions", href: "#transactions" }, { label: "Profile settings", href: "/account/settings" }].map(link => <Link key={link.label} href={link.href} className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-600">{link.label}</Link>)}</nav>
    {resumeCheckout && <Link href={savedCheckoutPath} className="button-secondary mt-5 min-h-11 px-4 text-sm">Return to your saved checkout<ArrowRight size={15} /></Link>}
    <div className="mt-8 grid gap-5 md:grid-cols-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6"><div className="flex items-center justify-between text-sm font-semibold text-slate-700"><span>Available wallet balance</span><Wallet size={20} className="text-blue-600" /></div><p className="mt-5 font-mono text-3xl font-bold text-blue-600">{formatPrice(data.balancePaisa / 100)}</p><a href="#add-funds" className="button-primary mt-5 min-h-10 px-4 text-xs"><Plus size={14} />Add funds</a></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-700">Recent orders</p><p className="mt-5 font-mono text-3xl font-bold">{data.orders.length}</p><a href="#new-order" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-blue-600">Create a new order<ArrowRight size={14} /></a></div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-slate-700">Payments being checked</p><p className="mt-5 font-mono text-3xl font-bold">{data.payments.filter((payment) => payment.kind === "topup" && payment.status === "pending").length}</p><a href="#payments" className="mt-5 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-blue-600">View payment history<ArrowRight size={14} aria-hidden="true" /></a></div>
    </div>
    <GrowthCatalog services={services} dashboard onOrderPlaced={refresh} />
    {(error || message) && <p role={error ? "alert" : "status"} className={"mt-5 rounded-lg border p-4 text-sm leading-6 " + (error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{error || message}</p>}
    <div className="mt-10 grid items-start gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div id="orders" className="min-w-0 scroll-mt-28">
        <h2 className="text-xl font-bold tracking-tight">Order history</h2><p className="mt-1 text-xs leading-6 text-slate-500">Your latest 100 orders, whether paid with eSewa or your wallet.</p>
        <div className="mt-5 space-y-3">{data.orders.length ? data.orders.map((order) => <article key={order.id} id={"order-" + order.id} className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[10px] text-slate-400">#{order.id.slice(0, 8)}</span><StatusBadge status={order.status} /></div><h3 className="mt-3 text-sm font-bold leading-6">{customerItemName(order.itemId, order.itemName)}</h3><div className="mt-3 flex justify-between gap-3 text-xs text-slate-500"><span>{order.itemKind === "package" ? "Package" : "Quantity: " + order.quantity.toLocaleString("en-US")} &middot; {order.method === "wallet" ? "Wallet" : "Direct eSewa"}</span><span className="font-mono font-bold text-slate-800">{formatPrice(order.amountPaisa / 100)}</span></div><p className="mt-2 text-[10px] text-slate-400">{date(order.createdAt)}</p>{order.status === "awaiting_delivery" && data.deliveryServices.find((service) => service.id === order.itemId) ? <DeliveryChoice orderId={order.id} service={data.deliveryServices.find((service) => service.id === order.itemId)!} quantity={order.quantity} onSaved={refresh} /> : order.status === "awaiting_payment" && data.deliveryServices.some((service) => service.id === order.itemId) ? <p className="mt-3 text-xs leading-6 text-blue-700">Your delivery timing is saved. Delivery starts automatically after your payment is confirmed.</p> : ["queued", "submitting", "submitted", "processing", "completed", "partial"].includes(order.status) ? <OrderDeliveryDetails minutes={order.deliveryWindowMinutes} value={order.deliveryPlan} /> : null}<FulfillmentDetails order={order} /></article>) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><p className="text-sm text-slate-500">No orders yet. Choose a service when you’re ready.</p><a href="#new-order" className="mt-4 inline-block text-sm font-semibold text-blue-600">Browse services</a></div>}</div>
      </div>
      <section id="add-funds" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="eyebrow">Account wallet</p><h2 className="mt-2 text-xl font-bold tracking-tight">Add funds with eSewa</h2><p className="mt-2 text-xs leading-6 text-slate-500">Choose an amount and read the wallet terms before paying. Our team checks your payment before adding it to your balance.</p>
        <form onSubmit={addFunds} className="mt-5 space-y-4"><div><label htmlFor="deposit-amount" className="text-xs font-semibold text-slate-700">Amount to add (NPR)</label><input id="deposit-amount" required disabled={busy} type="number" min="100" max="100000" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setReference(""); setWalletTermsAccepted(false); setWalletPaymentReady(false); }} className="field-input font-mono" /><div className="mt-2 flex flex-wrap gap-2">{[500, 1000, 2500].map((value) => <button type="button" disabled={busy} key={value} onClick={() => { setAmount(String(value)); setReference(""); setWalletTermsAccepted(false); setWalletPaymentReady(false); }} className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-[10px] text-slate-600">{formatPrice(value)}</button>)}</div></div>
          <TermsAcceptance purpose="wallet" accepted={walletTermsAccepted} language={walletTermsLanguage} disabled={busy} onAcceptedChange={value => { setWalletTermsAccepted(value); if (!value) setWalletPaymentReady(false); }} onLanguageChange={value => { if (value !== walletTermsLanguage) { setWalletTermsLanguage(value); setWalletTermsAccepted(false); setWalletPaymentReady(false); } }} />
          {walletPaymentReady && <div ref={walletPaymentRef} tabIndex={-1} role="region" aria-label="eSewa wallet payment instructions" className="space-y-4"><PaymentQr /><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">Pay exactly {formatPrice(Number(amount))}. Enter the transaction code from your receipt below.</p><div><label htmlFor="deposit-reference" className="text-xs font-semibold text-slate-700">eSewa transaction code</label><input id="deposit-reference" required disabled={busy} minLength={6} maxLength={64} pattern="[a-zA-Z0-9-]+" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction code from your payment receipt" className="field-input font-mono" /></div></div>}
          <button disabled={busy || !walletTermsAccepted} className="button-primary min-h-12 w-full px-4 text-sm disabled:opacity-50">{busy ? "Submitting..." : walletPaymentReady ? "Send payment details" : "Continue to eSewa payment"}<ArrowRight size={16} /></button>
        </form>
      </section>
    </div>
    <div className="mt-10 grid gap-7 lg:grid-cols-2"><section id="payments" className="min-w-0 scroll-mt-28"><h2 className="text-xl font-bold tracking-tight">Payment history</h2><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{data.payments.length ? data.payments.map((payment) => <div key={payment.id} id={"payment-" + payment.id} className="scroll-mt-28 border-b border-slate-100 p-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{payment.kind === "topup" ? "Wallet top-up" : "Order payment"} &middot; {formatPrice(payment.amountPaisa / 100)}</p><StatusBadge status={payment.status} /></div><p className="mt-2 break-all font-mono text-[10px] text-slate-500">{payment.reference}</p>{payment.note && <p className="mt-2 text-xs text-slate-600">{payment.note}</p>}</div>) : <p className="p-5 text-xs text-slate-500">No payments submitted yet.</p>}</div></section>
    <section id="transactions" className="min-w-0 scroll-mt-28"><h2 className="text-xl font-bold tracking-tight">Wallet transactions</h2><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">{data.ledger.length ? data.ledger.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 border-b border-slate-100 p-4 last:border-0"><div><p className="text-xs font-semibold">{entry.kind === "deposit" ? "Money added" : entry.kind === "refund" ? "Order refund" : "Order payment"}</p><p className="mt-1 text-[10px] text-slate-400">{date(entry.createdAt)}</p></div><p className={"font-mono text-sm font-bold " + (entry.amountPaisa > 0 ? "text-emerald-700" : "text-slate-800")}>{entry.amountPaisa > 0 ? "+" : "-"}{formatPrice(Math.abs(entry.amountPaisa) / 100)}</p></div>) : <p className="p-5 text-xs text-slate-500">Money you add and payments from your wallet will appear here.</p>}</div></section></div>
    <NotificationCenter compact />
  </section>;
}

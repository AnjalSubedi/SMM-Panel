"use client";
import Link from "next/link";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Wallet, X } from "lucide-react";
import { formatPrice } from "../lib/catalogFormat";
import type { CatalogItem } from "../lib/catalog";
import { supportsGradualDelivery } from "../lib/delivery";
import { requiredPlatforms, checkoutReturnPath } from "../lib/checkout";
import { authClient } from "../lib/auth-client";
import { isPublicOrderLink } from "../lib/orderLinks";
import PaymentQr from "./PaymentQr";
import TermsAcceptance from "./TermsAcceptance";
import { termsAcceptance, type TermsLanguage } from "../lib/terms";

const draftKey = "dmnp-checkout-draft";

export default function CheckoutModal({ item, onDismiss, returnTo, onOrderPlaced }: { item: CatalogItem; onDismiss: () => void; returnTo?: string; onOrderPlaced?: () => Promise<void> }) {
  const returnPath = checkoutReturnPath(returnTo);
  const loginReturn = encodeURIComponent(returnPath);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const requestKey = useRef("");
  const { data: authSession, isPending: sessionPending } = authClient.useSession();
  const session = authSession?.user.emailVerified ? authSession : null;
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLanguage, setTermsLanguage] = useState<TermsLanguage>("en");
  const [paymentReady, setPaymentReady] = useState(false);
  const [tab, setTab] = useState<"direct" | "wallet">("direct");
  const platforms = requiredPlatforms(item);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ id: string; status: string; amountPaisa: number; method: string } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focus = document.activeElement;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) document.body.style.paddingRight = String(parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar) + "px";
    document.body.style.overflow = "hidden";
    dialog.showModal(); titleRef.current?.focus();
    try {
      const draft = JSON.parse(sessionStorage.getItem(draftKey) || "null");
      if (draft?.itemId === item.id && draft.links && typeof draft.links === "object") {
        const publicLinks: Record<string, string> = {};
        for (const platform of platforms) if (typeof draft.links[platform] === "string") publicLinks[platform] = draft.links[platform];
        setLinks(publicLinks);
        if (draft.method === "wallet") setTab("wallet");
      }
    } catch { /* An invalid browser draft is ignored. */ }
    return () => {
      dialog.close(); document.body.style.overflow = overflow; document.body.style.paddingRight = padding;
      if (focus instanceof HTMLElement && focus.isConnected) focus.focus({ preventScroll: true });
    };
    // The mounted modal owns one immutable selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) { setBalance(null); return; }
    const controller = new AbortController();
    setBalanceError(false);
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json(); setBalance(data.balancePaisa); })
      .catch(() => { if (!controller.signal.aborted) setBalanceError(true); });
    return () => controller.abort();
  }, [session?.user.id]);

  useEffect(() => {
    if (paymentReady && tab === "direct") {
      paymentRef.current?.focus({ preventScroll: true });
      paymentRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [paymentReady, tab]);

  function saveDraft() {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ itemId: item.id, quantity: item.kind === "package" ? 1 : Number(item.quantity), links, method: tab, returnTo: returnPath })); } catch { /* Checkout is still available without browser storage. */ }
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : tab === "direct" ? 1 : 0;
    setTab(next === 0 ? "direct" : "wallet"); setPaymentReady(false); setError("");
    tabRefs.current[next]?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!termsAccepted) { setError("Please read and accept the terms before payment."); return; }
    if (platforms.some(platform => !isPublicOrderLink((links[platform] || "").trim(), platform))) { setError("Enter a valid public link from the selected platform before paying. Check the domain and remove any login details."); return; }
    if (!paymentReady) { if (event.currentTarget.reportValidity()) { setPaymentReady(true); setError(""); } return; }
    setBusy(true); setError("");
    if (!requestKey.current) requestKey.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id, quantity: item.kind === "package" ? 1 : Number(item.quantity),
          links: platforms.map((platform) => ({ platform, url: (links[platform] || "").trim() })),
          method: tab, requestKey: requestKey.current, ...termsAcceptance(termsLanguage),
          ...(tab === "direct" ? { reference: reference.trim(), ...(!session ? { email: email.trim() } : {}) } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create your order.");
      setSuccess(result);
      try { sessionStorage.removeItem(draftKey); } catch { /* No sensitive data is stored in the draft. */ }
      if (onOrderPlaced) void onOrderPlaced().catch(() => undefined);
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to submit. Please retry with the same details."); }
    finally { setBusy(false); }
  }

  const insufficient = balance !== null && balance < Math.round(item.price * 100);

  return <dialog ref={dialogRef} aria-labelledby="checkout-title" onCancel={(event) => { event.preventDefault(); if (!busy) onDismiss(); }} className="checkout-dialog fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl">
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:px-7"><div><p className="eyebrow">Your order</p><h2 id="checkout-title" ref={titleRef} tabIndex={-1} className="mt-1 text-2xl font-bold tracking-tight outline-none">{success ? "Order received" : "Review and pay"}</h2></div><button type="button" disabled={busy} aria-label="Close checkout" onClick={onDismiss} className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"><X size={18} aria-hidden="true" /></button></div>
    <div className="p-5 sm:p-7">
      {success ? <div className="py-5 text-center"><CheckCircle2 size={42} className="mx-auto text-emerald-600" aria-hidden="true" /><h3 className="mt-4 text-xl font-bold">{success.method === "wallet" ? "Paid from your wallet" : "Payment submitted for review"}</h3><p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">{success.method === "wallet" ? success.status === "awaiting_delivery" ? "We’ve taken the payment from your wallet. Open My orders and choose when you’d like delivery to start." : "We’ve taken the payment from your wallet. Your order is waiting to start." : session && supportsGradualDelivery(item) ? "We’ve saved your order. Once our team checks your payment, you can choose your delivery timing in My orders." : "We’ve saved your order. Our team will check your eSewa payment before delivery starts."}</p><p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs">Order #{success.id}</p><p className="mt-4 font-mono text-2xl font-bold text-blue-600">{formatPrice(success.amountPaisa / 100)}</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{session && <Link onNavigate={onDismiss} href={"/account#order-" + encodeURIComponent(success.id)} className="button-primary min-h-11 px-5 text-sm">{success.status === "awaiting_delivery" ? "Choose delivery timing" : "View my orders"}<ArrowRight size={15} /></Link>}<button type="button" onClick={onDismiss} className="button-secondary min-h-11 px-5 text-sm">Continue browsing</button></div>{!session && <p className="mt-4 text-xs leading-6 text-slate-500">Keep your order number and eSewa transaction code in case you need help. Orders placed without signing in will not appear in an account you create later.</p>}</div> : <>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{item.kind === "package" ? "Package " + item.packageCode : item.platform + " · Quantity: " + item.quantity}</p><h3 className="mt-2 text-sm font-bold leading-6">{item.name}</h3>{item.kind === "package" && <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">{item.inclusions.map(feature => <li key={feature}>{feature}</li>)}</ul>}<div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span className="text-xs text-slate-600">Order total</span><span className="font-mono text-2xl font-bold text-blue-600">{formatPrice(item.price)}</span></div></div>
        {supportsGradualDelivery(item) && <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-6 text-blue-800">{session ? "Once your payment is checked, open My orders to choose the usual delivery speed or spread delivery over time. We’ll wait for your choice before starting." : "Want delivery spread over time? Sign in before ordering. After we check your payment, you can choose a timeframe. Guest orders use the usual service speed."}</p>}
        <div role="tablist" aria-label="Payment method" className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">{(["direct", "wallet"] as const).map((method, index) => <button key={method} ref={(element) => { tabRefs.current[index] = element; }} type="button" role="tab" id={"payment-tab-" + method} aria-selected={tab === method} aria-controls={"payment-panel-" + method} tabIndex={tab === method ? 0 : -1} onKeyDown={navigateTabs} onClick={() => { setTab(method); setPaymentReady(false); setError(""); }} disabled={busy} className={"flex min-h-12 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-semibold " + (tab === method ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-900")}>{method === "wallet" && <Wallet size={15} aria-hidden="true" />}{method === "direct" ? "Pay directly with eSewa" : "Use account wallet"}</button>)}</div>
        <form onSubmit={submit}>
          <div id="payment-panel-wallet" role="tabpanel" aria-labelledby="payment-tab-wallet" hidden={tab !== "wallet"} className="mt-5">
            {!sessionPending && session && <div className="rounded-xl border border-blue-100 bg-blue-50 p-5"><p className="text-xs font-semibold text-slate-600">Available wallet balance</p><p className="mt-2 font-mono text-3xl font-bold text-slate-900">{balance !== null ? formatPrice(balance / 100) : "NPR --"}</p></div>}
            {sessionPending ? <p className="mt-3 text-xs text-slate-500">Checking your account...</p> : !session ? <div className="mt-4 rounded-lg border border-slate-200 p-4"><p className="text-xs leading-6 text-slate-600">Sign in to add funds to your wallet and pay for this order. Your service selection will be saved.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><Link href={"/login?next=" + loginReturn} onClick={saveDraft} onNavigate={onDismiss} className="button-primary min-h-10 px-4 text-xs">Sign in to add funds</Link><Link href={"/register?next=" + loginReturn} onClick={saveDraft} onNavigate={onDismiss} className="button-secondary min-h-10 px-4 text-xs">Create account</Link></div></div> : balanceError ? <p role="alert" className="mt-3 text-xs text-red-700">Unable to load your wallet balance. Reopen checkout to try again.</p> : insufficient ? <p className="mt-3 text-xs leading-6 text-amber-800">You need {formatPrice((Math.round(item.price * 100) - balance!) / 100)} more. <Link href="/account?resume=1#add-funds" onClick={saveDraft} onNavigate={onDismiss} className="font-semibold text-blue-600">Add funds</Link> or choose direct eSewa payment.</p> : <p className="mt-3 text-xs leading-6 text-slate-500">We’ll take the total from your wallet when you place this order.</p>}
          </div>

          <div className="mt-5 space-y-4">{platforms.map((platform, index) => <div key={platform}><label htmlFor={"public-url-" + index} className="text-xs font-semibold text-slate-700">{platform} profile, page or video link</label><input id={"public-url-" + index} type="url" required disabled={busy} maxLength={2048} value={links[platform] || ""} onChange={(event) => { setLinks({ ...links, [platform]: event.target.value }); setTermsAccepted(false); setPaymentReady(false); }} placeholder="https://..." className="field-input" /><p className="mt-2 text-[11px] leading-5 text-slate-500">Check the link and keep the account or content public during delivery.</p></div>)}</div>
          {tab === "direct" && !session && <div className="mt-4"><label htmlFor="guest-email" className="text-xs font-semibold text-slate-700">Your email address</label><input id="guest-email" required disabled={busy} type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="field-input" placeholder="you@example.com" /><p className="mt-2 text-[10px] text-slate-500">No account required. <Link onClick={saveDraft} onNavigate={onDismiss} href={"/login?next=" + loginReturn} className="font-semibold text-blue-600">Sign in</Link> to keep this order in your history.</p></div>}
          <div className="mt-5"><TermsAcceptance purpose="order" accepted={termsAccepted} language={termsLanguage} disabled={busy} onAcceptedChange={value => { setTermsAccepted(value); if (!value) setPaymentReady(false); }} onLanguageChange={value => { if (value !== termsLanguage) { setTermsLanguage(value); setTermsAccepted(false); setPaymentReady(false); } }} /></div>
          <div ref={paymentRef} tabIndex={-1} id="payment-panel-direct" role="tabpanel" aria-labelledby="payment-tab-direct" hidden={tab !== "direct"} className={paymentReady ? "mt-5" : undefined}>{paymentReady && tab === "direct" && <>
            <PaymentQr />
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">Pay exactly {formatPrice(item.price)}. Send us the transaction code from your receipt so our team can check the payment.</p>
            <div className="mt-4"><label htmlFor="transaction-code" className="text-xs font-semibold text-slate-700">eSewa transaction code</label><input id="transaction-code" required disabled={busy} minLength={6} maxLength={64} pattern="[a-zA-Z0-9-]+" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction code from your eSewa receipt" className="field-input font-mono" /></div>
          </>}</div>
          {paymentReady && tab === "wallet" && <p className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-blue-800">You have accepted the order terms. Confirm below to pay {formatPrice(item.price)} from your wallet.</p>}
          {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</p>}
          <button disabled={busy || !termsAccepted || sessionPending || (tab === "wallet" && (!session || balance === null || balanceError || insufficient))} className="button-primary mt-5 min-h-12 w-full px-4 text-sm disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Placing your order..." : !paymentReady ? tab === "wallet" ? "Review wallet payment" : "Continue to eSewa payment" : tab === "wallet" ? "Pay " + formatPrice(item.price) + " from wallet" : "Send payment details"}<ArrowRight size={15} aria-hidden="true" /></button>
        </form>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-400"><LockKeyhole size={11} aria-hidden="true" />Your social account password is never required.</p>
      </>}
    </div>
  </dialog>;
}

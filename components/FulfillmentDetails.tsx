"use client";
import { useState } from "react";
import type { OrderRecord } from "../lib/account-types";
import { formatPrice } from "../lib/catalogFormat";
export default function FulfillmentDetails({ order, admin = false, onUpdated }: { order: OrderRecord; admin?: boolean; onUpdated?: () => Promise<void> }) {
  const [references, setReferences] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function reconcile(jobId: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/fulfillment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, jobId, providerOrderId: references[jobId] }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to confirm the reference.");
      await onUpdated?.();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Unable to confirm the reference."); }
    finally { setBusy(false); }
  }
  if (!order.fulfillment?.length) return order.deliveryMessage ? <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">{order.deliveryMessage}</p> : null;
  const awaiting = ["awaiting_payment", "payment_rejected", "awaiting_delivery"].includes(order.status);
  return <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-600">
    {!awaiting && <p className="font-semibold text-slate-700">Automatic delivery</p>}
    {!awaiting && order.fulfillment.map(job => <div key={job.id}>
      {order.fulfillment!.length > 1 && <p className="font-semibold">{job.name} &middot; {job.quantity.toLocaleString("en-US")} units</p>}
      {job.providerOrderId && <p>{job.providerStatus || "Accepted for delivery"}{admin && " - Provider order #" + job.providerOrderId}</p>}
      {job.remains !== null && <p>{Math.max(0, job.quantity - job.remains).toLocaleString("en-US")} of {job.quantity.toLocaleString("en-US")} delivered</p>}
      {job.message && <p className="text-amber-800">{job.message}</p>}
      {job.refundedPaisa > 0 && <p className="text-emerald-700">{formatPrice(job.refundedPaisa / 100)} returned to your wallet.</p>}
      {!order.userId && ["rejected", "cancelled", "partial"].includes(job.state) && <p>Contact us with your order number to arrange the refund for undelivered units.</p>}
      {admin && job.state === "unknown" && <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><p>Check Suvakrio for this order before taking action. Link its existing reference to resume status updates. Do not create a second provider order.</p><label htmlFor={"provider-ref-" + job.id} className="mt-2 block font-semibold">Existing provider order number</label><input id={"provider-ref-" + job.id} inputMode="numeric" maxLength={20} value={references[job.id] || ""} onChange={event => setReferences({ ...references, [job.id]: event.target.value })} className="field-input" /><button type="button" disabled={busy || !/^[1-9][0-9]{0,19}$/.test(references[job.id] || "")} onClick={() => void reconcile(job.id)} className="button-secondary mt-2 min-h-10 px-3 text-xs disabled:opacity-40">{busy ? "Checking..." : "Link existing order"}</button></div>}
    </div>)}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>;
}

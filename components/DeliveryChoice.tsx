"use client";

import { useId, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import type { CatalogItem } from "../lib/catalog";
import { deliveryLabel, planDelivery } from "../lib/delivery";

export default function DeliveryChoice({ orderId, service, quantity, onSaved }: { orderId: string; service: CatalogItem; quantity: number; onSaved: () => Promise<void> }) {
  const id = useId();
  const [gradual, setGradual] = useState(false);
  const [hours, setHours] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const minutes = gradual ? Number(hours) * 60 : 0;
  let plan = null;
  let problem = "";
  try {
    if (gradual && (!hours || !Number.isInteger(Number(hours)))) throw new Error("Choose a whole number of hours from 1 to 168.");
    plan = planDelivery(service, quantity, minutes);
  } catch (issue) { problem = (issue as Error).message; }

  async function confirm() {
    if (problem) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/account/orders/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, deliveryWindowMinutes: minutes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save delivery timing.");
      await onSaved();
    } catch (issue) { setError((issue as Error).message); }
    finally { setBusy(false); }
  }

  return <div data-delivery-order={orderId} className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4 sm:p-5">
    <p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Clock3 size={16} className="text-blue-600" aria-hidden="true" />Payment confirmed. Choose delivery.</p>
    <p className="mt-2 text-xs leading-6 text-slate-600">Keep the original service speed or spread your order across a timeframe. Your total stays the same.</p>
    <fieldset disabled={busy} className="mt-4"><legend className="sr-only">Delivery timing</legend><div className="grid gap-3 sm:grid-cols-2">
      {[false, true].map((paced) => <label key={String(paced)} className={"flex cursor-pointer items-start gap-2 rounded-lg border p-3 " + (gradual === paced ? "border-blue-600 bg-white" : "border-slate-200 bg-white/60")}><input type="radio" name={id + "-delivery"} checked={gradual === paced} onChange={() => { setGradual(paced); setError(""); }} className="mt-0.5 accent-blue-600" /><span><span className="block text-xs font-bold text-slate-800">{paced ? "Gradual delivery" : "Default delivery"}</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">{paced ? "Delivered in spaced batches" : "Original provider timing"}</span></span></label>)}
    </div>
    {gradual && <div className="mt-4"><label htmlFor={id + "-hours"} className="text-xs font-semibold text-slate-700">Spread delivery over</label><div className="mt-2 flex items-center gap-3"><input id={id + "-hours"} type="number" min={1} max={168} step={1} inputMode="numeric" value={hours} onChange={(event) => setHours(event.target.value)} aria-invalid={Boolean(problem)} aria-describedby={id + "-preview"} className="h-11 w-24 rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm font-semibold" /><span className="text-xs text-slate-600">hours (up to 7 days)</span></div><div className="mt-3 flex flex-wrap gap-2">{[1, 3, 6, 12, 24, 72].map((value) => <button key={value} type="button" aria-pressed={hours === String(value)} onClick={() => setHours(String(value))} className={"rounded-md border px-3 py-2 font-mono text-[11px] font-semibold " + (hours === String(value) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600")}>{value}h</button>)}</div></div>}
    </fieldset>
    <div id={id + "-preview"} aria-live="polite" className="mt-4 text-xs leading-6">{problem ? <p className="text-amber-800">{problem}</p> : plan ? <><p className="font-semibold text-blue-800">{deliveryLabel(minutes)}: {plan.runs} batches of {plan.quantityPerRun.toLocaleString("en-US")}, every {plan.intervalMinutes} minutes.</p><p className="mt-2 text-slate-500">The window runs from the first to the last batch dispatch after scheduling. Provider processing may extend completion time.</p></> : <p className="text-slate-600">Default uses the service’s original start and delivery times.</p>}</div>
    {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
    <button type="button" disabled={busy || Boolean(problem)} onClick={confirm} className="button-primary mt-4 min-h-11 w-full px-4 text-xs disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving delivery choice..." : gradual ? "Confirm gradual delivery" : "Confirm default delivery"}<ArrowRight size={14} aria-hidden="true" /></button>
    <p className="mt-2 text-[10px] leading-5 text-slate-500">No additional payment. Contact support for changes after confirming.</p>
  </div>;
}

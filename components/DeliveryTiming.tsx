"use client";
import { useId, useState } from "react";
import { Info } from "lucide-react";
import type { CatalogItem } from "../lib/catalog";
import { deliveryLabel, planDelivery, supportsGradualDelivery } from "../lib/delivery";

export default function DeliveryTiming({ service, quantity, value, onChange, disabled = false }: { service: CatalogItem; quantity: number; value: number; onChange: (minutes: number) => void; disabled?: boolean }) {
  const id = useId();
  const [showInfo, setShowInfo] = useState(false);
  if (!supportsGradualDelivery(service)) return null;
  const options = [60, 180, 360, 720, 1440, 4320, 10080].filter(minutes => {
    try { planDelivery(service, quantity, minutes); return true; } catch { return false; }
  });
  let plan = null;
  try { plan = planDelivery(service, quantity, value); } catch { /* Checkout displays invalid saved selections. */ }
  return <div data-delivery-timing className="mt-5 rounded-xl border border-slate-200 p-4">
    <div className="flex items-center gap-1.5"><label htmlFor={id} className="text-xs font-semibold text-slate-700">Delivery timing</label><button type="button" aria-label="About delivery timing" aria-expanded={showInfo} aria-controls={id + "-info"} onClick={() => setShowInfo(!showInfo)} className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"><Info size={15} aria-hidden="true" /></button></div>
    <p id={id + "-info"} hidden={!showInfo} className="mb-3 text-xs leading-6 text-slate-600">Choose the usual service speed, or spread your order into smaller groups over time. Gradual delivery controls when those groups are sent; it does not guarantee when followers appear. The total quantity and price stay the same.</p>
    <select id={id} value={value} disabled={disabled} aria-describedby={id + "-preview"} onChange={event => onChange(Number(event.target.value))} className="field-input mt-1">
      <option value={0}>Default delivery - usual service speed</option>
      {options.map(minutes => <option key={minutes} value={minutes}>{deliveryLabel(minutes)}</option>)}
    </select>
    <p id={id + "-preview"} aria-live="polite" className="mt-2 text-[11px] leading-5 text-slate-500">{plan ? plan.runs + " groups of " + plan.quantityPerRun.toLocaleString("en-US") + ", sent every " + plan.intervalMinutes + " minutes after delivery starts." : options.length ? "Your order starts automatically after payment is confirmed. No extra step afterward." : "This quantity cannot be split into valid groups. Your order will use the usual service speed."}</p>
  </div>;
}

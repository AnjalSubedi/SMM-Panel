import { deliveryLabel, readDeliveryPlan, providerDripSettings } from "../lib/delivery";

export default function OrderDeliveryDetails({ minutes, value, admin = false }: { minutes: number; value: string | null; admin?: boolean }) {
  const plan = readDeliveryPlan(value);
  const settings = plan ? providerDripSettings(plan) : null;
  return <div className={"mt-3 rounded-lg border p-3 text-xs leading-6 " + (plan ? "border-blue-100 bg-blue-50/60 text-blue-900" : "border-slate-100 bg-slate-50 text-slate-600")}>
    <p className="font-semibold">{deliveryLabel(minutes)}</p>
    {plan && <><p className="mt-1">{plan.runs} batches of {plan.quantityPerRun.toLocaleString("en-US")}, spaced {plan.intervalMinutes} minutes apart.</p><p className="mt-1 text-[11px] text-slate-500">Your timeframe starts when the first group is sent for delivery. Followers may take longer to appear on your profile.</p></>}
    {admin && settings && plan && <div className="mt-3 border-t border-blue-100 pt-3"><p className="font-semibold">Provider drip-feed settings</p><dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">{Object.entries(settings).map(([key, value]) => <div key={key}><dt className="text-slate-500">{key === "quantity" ? "quantity / run" : key === "interval" ? "interval (min)" : key}</dt><dd className="font-bold">{value.toLocaleString("en-US")}</dd></div>)}</dl><p className="mt-2 text-[11px] text-amber-800">Total quantity: {plan.totalQuantity.toLocaleString("en-US")}. These settings are submitted automatically. The quantity shown is per batch; the total is not multiplied.</p></div>}
  </div>;
}

import type { CatalogItem } from "../lib/catalog";
import { formatPrice, formatQuantity } from "../lib/catalogFormat";

// Rendered on the server: prices remain readable without opening the calculator.
export default function ServicePriceTable({ services, label }: { services: readonly CatalogItem[]; label: string }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
    <table className="w-full min-w-[480px] text-left text-sm">
      <caption className="sr-only">{label} service rates in Nepalese rupees and order quantity limits</caption>
      <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="px-4 py-3 font-semibold">Service</th><th scope="col" className="px-4 py-3 font-semibold">Rate in NPR</th><th scope="col" className="px-4 py-3 font-semibold">Order quantity</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{services.map(service => <tr key={service.id}>
        <th scope="row" className="px-4 py-4 font-medium leading-6 text-slate-900">{service.name}{service.quantityLimitsVerified === false && <span className="mt-1 block text-xs font-normal text-amber-800">Confirm availability before paying</span>}</th>
        <td className="px-4 py-4 align-top"><span className="whitespace-nowrap font-mono font-semibold text-blue-700">{formatPrice(service.price)}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{service.unitLabel}</span></td>
        <td className="px-4 py-4 align-top text-xs leading-6 text-slate-600">{formatQuantity(service.min ?? 1)}–{formatQuantity(service.max ?? service.min ?? 1)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}

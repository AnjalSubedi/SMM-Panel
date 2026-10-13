"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, LockKeyhole, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { formatPrice, formatQuantity, platformOrder, type CatalogItem } from "../lib/catalog";
import { calculateTotal, normalizeQuantity, prepareServiceOrder } from "../lib/order";
import { getServiceCategory } from "../lib/serviceCategories";
import PlatformIcon from "./PlatformIcon";

const selectClass = "block min-h-12 w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-3 pr-10 text-sm text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function QuantityConfigurator({ service, onOrder }: { service: CatalogItem; onOrder: (item: CatalogItem) => void }) {
  const [input, setInput] = useState(String(normalizeQuantity(service, service.min ?? 1)));
  const min = service.min ?? 1;
  const max = service.max ?? min;
  const fixed = min === max;
  const rawQuantity = input.trim() === "" ? NaN : Number(input);
  const quantity = normalizeQuantity(service, rawQuantity);
  const valid = Number.isInteger(rawQuantity) && rawQuantity >= min && rawQuantity <= max;
  const total = calculateTotal(service, quantity);
  const adjustment = 1;
  const increments = min <= 100 ? [10, 100, 1000] : [100, 1000, 5000];

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
        <PlatformIcon platform={service.platform ?? "Web & Discord"} />{service.platform}
        <span className="ml-auto font-mono text-[10px] font-normal text-slate-400">{service.providerServiceId ? "#" + service.providerServiceId : service.id}</span>
      </div>
      <h4 className="mt-3 text-base font-bold leading-6 text-slate-900">{service.name}</h4>
      <p className="mt-2 text-xs text-slate-500">{formatPrice(service.price)} · {service.unitLabel}</p>
      {service.quantityLimitsVerified === false && <p className="mt-2 text-[11px] leading-5 text-slate-500">Provider availability and quantity limits require confirmation before delivery.</p>}
      <div className="mt-6 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="quantity" className="text-sm font-semibold text-slate-800">Quantity</label>
          <span className="text-[10px] text-slate-500">{fixed ? "Fixed package" : `Min ${formatQuantity(min)} · Max ${formatQuantity(max)}`}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" aria-label="Decrease quantity" disabled={fixed || quantity <= min} onClick={() => setInput(String(normalizeQuantity(service, quantity - adjustment)))} className="quantity-button"><Minus size={16} aria-hidden="true" /></button>
          <input id="quantity" type="number" inputMode="numeric" min={min} max={max} step={1} readOnly={fixed} value={input} aria-invalid={!valid} aria-describedby={!valid ? "quantity-error" : undefined} onChange={(event) => setInput(event.target.value)} onBlur={() => setInput(String(quantity))} className="h-12 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-center font-mono text-base font-bold text-slate-900 focus:border-blue-600" />
          <button type="button" aria-label="Increase quantity" disabled={fixed || quantity >= max} onClick={() => setInput(String(normalizeQuantity(service, quantity + adjustment)))} className="quantity-button"><Plus size={16} aria-hidden="true" /></button>
        </div>
        {!valid && <p id="quantity-error" className="mt-2 text-xs text-amber-700">Enter a whole number from {formatQuantity(min)} to {formatQuantity(max)}.</p>}
        {!fixed && <>
          <input aria-label="Quantity slider" type="range" min={min} max={max} step={1} value={quantity} onChange={(event) => setInput(event.target.value)} className="quantity-range mt-5 w-full" />
          <div className="mt-4 grid grid-cols-3 gap-2">{increments.map((increment) => <button key={increment} type="button" disabled={quantity >= max} onClick={() => setInput(String(normalizeQuantity(service, quantity + increment)))} className="min-h-9 rounded-lg border border-slate-200 bg-white px-1 font-mono text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">+{formatQuantity(increment)}</button>)}</div>
        </>}
      </div>
      {!fixed && <p className="mt-3 text-[11px] leading-5 text-slate-500">Enter any whole number within this service’s limits. Pricing is proportional to your quantity.</p>}
      <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-xs font-medium text-slate-600">Your total</p>
        <p aria-live="polite" aria-atomic="true" className="mt-1 font-mono text-3xl font-extrabold tracking-tight text-blue-600">{valid ? formatPrice(total) : "—"}</p>
        <p className="mt-2 text-[10px] text-slate-500">{formatQuantity(quantity)} units · Billed in Nepalese Rupees</p>
      </div>
      <button type="button" disabled={!valid} aria-haspopup="dialog" onClick={() => onOrder(prepareServiceOrder({ ...service, category: getServiceCategory(service) }, quantity))} className="button-primary mt-4 w-full px-3 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-40">Proceed to Checkout<ArrowRight size={16} aria-hidden="true" /></button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><LockKeyhole size={11} aria-hidden="true" />No login credentials required.</p>
    </div>
  );
}

export default function InteractiveServiceDirectory({ services, onOrder }: { services: CatalogItem[]; onOrder: (item: CatalogItem) => void }) {
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [serviceId, setServiceId] = useState("");
  const platforms = platformOrder.filter((name) => services.some((service) => service.platform === name));
  const platformServices = services.filter((service) => service.platform === platform);
  const categories = [...new Set(platformServices.map(getServiceCategory))];
  const categoryServices = platformServices.filter((service) => getServiceCategory(service) === category);
  const selected = categoryServices.find((service) => service.id === serviceId);

  return (
    <section id="calculator" aria-labelledby="catalog-heading" className="section-space scroll-mt-24 bg-[#FAFAFA]">
      <div className="page-container">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Your platform. Your pace.</p>
            <h2 id="catalog-heading" className="section-heading mt-3 max-w-2xl">Full Service Catalog &amp; Pricing Calculator</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Choose a platform, pick a category, then select the service you need.</p>
          </div>
          <p className="shrink-0 font-mono text-xs text-slate-500">{platforms.length.toString().padStart(2, "0")} platforms <span className="mx-2 text-slate-300">/</span> {services.length} services</p>
        </div>
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h3 className="text-lg font-bold tracking-tight text-slate-900">Find your growth service</h3>
            <p className="mt-1 text-xs leading-6 text-slate-500">Three simple selections. Pricing updates as you configure.</p>
            <div className="mt-6 space-y-6">
              <div>
                <label htmlFor="service-platform" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="flex size-6 items-center justify-center rounded-md bg-blue-50 font-mono text-[10px] text-blue-600">01</span>Choose platform</label>
                <div className="relative"><select id="service-platform" value={platform} onChange={(event) => { setPlatform(event.target.value); setCategory(""); setServiceId(""); }} className={selectClass}>
                  <option value="">Select a platform</option>
                  {platforms.map((name) => <option key={name} value={name}>{name === "X (Twitter)" ? "X / Twitter" : name}</option>)}
                </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-4 text-slate-400" /></div>
              </div>
              <div>
                <label htmlFor="service-category" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="flex size-6 items-center justify-center rounded-md bg-blue-50 font-mono text-[10px] text-blue-600">02</span>Choose category</label>
                <div className="relative"><select id="service-category" disabled={!platform} value={category} onChange={(event) => { setCategory(event.target.value); setServiceId(""); }} className={selectClass}>
                  <option value="">{platform ? "Select a category" : "Choose a platform first"}</option>
                  {categories.map((name) => <option key={name} value={name}>{name} ({platformServices.filter((service) => getServiceCategory(service) === name).length})</option>)}
                </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-4 text-slate-400" /></div>
              </div>
              <div>
                <label htmlFor="service-boost" className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="flex size-6 items-center justify-center rounded-md bg-blue-50 font-mono text-[10px] text-blue-600">03</span>Choose specific service</label>
                <div className="relative"><select id="service-boost" disabled={!category} value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={selectClass}>
                  <option value="">{category ? "Select a service" : "Choose a category first"}</option>
                  {categoryServices.map((service) => <option key={service.id} value={service.id}>{service.name} — {formatPrice(service.price)} / {service.unitLabel}</option>)}
                </select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-4 text-slate-400" /></div>
                {category && <p className="mt-2 text-[11px] text-slate-500">{categoryServices.length} {categoryServices.length === 1 ? "service" : "services"} available in this category.</p>}
              </div>
            </div>
            {selected && <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-800">{selected.name}</p><p className="mt-2 font-mono text-sm font-bold text-emerald-700">{formatPrice(selected.price)} / {selected.unitLabel}</p><p className="mt-2 text-xs leading-5 text-emerald-800">Set your quantity in the order panel to see the exact total.</p></div>}
          </div>
          <aside aria-labelledby="configurator-heading" className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-md shadow-slate-200/60 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><SlidersHorizontal size={16} aria-hidden="true" /></span><div><h3 id="configurator-heading" className="text-sm font-bold text-slate-900">Configure your order</h3><p className="mt-0.5 text-[11px] text-slate-500">Transparent pricing. No surprises.</p></div></div>
            {selected ? <QuantityConfigurator key={selected.id + ":" + selected.min + ":" + selected.max} service={selected} onOrder={onOrder} /> : <div role="status" className="px-6 py-12 text-center"><span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600"><SlidersHorizontal size={22} aria-hidden="true" /></span><h4 className="mt-4 text-sm font-bold text-slate-800">{!platform ? "Start with your platform" : !category ? "Choose a boost category" : "Select your specific service"}</h4><p className="mx-auto mt-2 max-w-xs text-xs leading-6 text-slate-500">Once you select a service, its quantity options and live price calculator will appear here.</p></div>}
          </aside>
        </div>
      </div>
    </section>
  );
}

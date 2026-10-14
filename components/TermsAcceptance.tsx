"use client";
import Link from "next/link";
import { termsCopy, type TermsLanguage, type TermsPurpose } from "../lib/terms";

type Props = { purpose: TermsPurpose; accepted: boolean; language: TermsLanguage; onAcceptedChange: (value: boolean) => void; onLanguageChange: (value: TermsLanguage) => void; disabled?: boolean };
export default function TermsAcceptance({ purpose, accepted, language, onAcceptedChange, onLanguageChange, disabled = false }: Props) {
  const copy = termsCopy[language];
  const items = copy[purpose];
  return <fieldset data-terms={purpose} disabled={disabled} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <legend className="sr-only">{purpose === "order" ? "Order terms acceptance" : "Wallet terms acceptance"}</legend>
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-900" lang={language}>{purpose === "order" ? copy.orderTitle : copy.walletTitle}</h3><div role="group" aria-label="Terms language" className="inline-flex gap-1 rounded-md border border-slate-200 bg-white p-1">{(["en", "ne"] as const).map(value => <button key={value} type="button" aria-pressed={language === value} onClick={() => onLanguageChange(value)} className={"min-h-8 rounded-sm px-2.5 text-xs font-semibold " + (language === value ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>{value === "en" ? "English" : "नेपाली"}</button>)}</div></div>
    <div lang={language}><ol className="mt-4 list-decimal space-y-2 pl-4 text-xs leading-6 text-slate-700">{items.slice(0, purpose === "order" ? 5 : 3).map(item => <li key={item.title}>{item.summary}</li>)}</ol>
      <details className="mt-3 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">{copy.details}</summary><ol className="mt-4 space-y-4">{items.map(item => <li key={item.title}><h4 className="text-xs font-semibold text-slate-900">{item.title}</h4><p className="mt-1 text-xs leading-6 text-slate-600">{item.text}</p></li>)}</ol><p className="mt-4 text-xs leading-6 text-slate-600">{copy.rights}</p></details>
      <p className="mt-3"><Link href={"/terms#" + purpose + "-" + language} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 underline underline-offset-4">{copy.policyLink}<span className="sr-only"> (opens in a new tab)</span></Link></p>
      <label htmlFor={purpose + "-terms-acceptance"} className="mt-4 flex cursor-pointer items-start gap-3 border-t border-slate-200 pt-4 text-xs font-medium leading-6 text-slate-800"><input id={purpose + "-terms-acceptance"} type="checkbox" required checked={accepted} onChange={event => onAcceptedChange(event.target.checked)} className="mt-1 size-4 shrink-0 accent-blue-600" /><span>{purpose === "order" ? copy.orderAgreement : copy.walletAgreement}</span></label>
    </div>
  </fieldset>;
}

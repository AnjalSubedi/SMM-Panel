import { orderQuestions } from "../lib/servicePages";
import { supportUrl } from "../config/site";

export default function OrderQuestions() {
  return <section className="section-space border-t border-slate-200 bg-[#FAFAFA]" aria-labelledby="order-questions-heading"><div className="page-container grid gap-8 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
    <div><p className="eyebrow">Before you pay</p><h2 id="order-questions-heading" className="section-heading mt-3">A few things worth knowing.</h2><p className="mt-4 text-sm leading-7 text-slate-600">Not sure which option fits? <a href={supportUrl} className="font-semibold text-blue-700 underline underline-offset-4">Ask us on WhatsApp</a> with the platform and service name.</p></div>
    <div className="divide-y divide-slate-200 border-y border-slate-200">{orderQuestions.map(item => <details key={item.question} className="py-1"><summary className="cursor-pointer py-4 text-sm font-semibold leading-6 text-slate-900 marker:text-blue-600">{item.question}</summary><p className="pb-5 text-sm leading-7 text-slate-600">{item.answer}</p></details>)}</div>
  </div></section>;
}

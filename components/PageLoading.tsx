export default function PageLoading({ title = "Loading page", dashboard = false }: { title?: string; dashboard?: boolean }) {
  return <section className="page-container py-10 sm:py-14" aria-busy="true" aria-label={title}>
    <p role="status" className="text-sm font-medium text-slate-600">{title}…</p>
    <div aria-hidden="true" className="mt-6 space-y-5 motion-safe:animate-pulse">
      <div className="h-8 w-56 max-w-full rounded-md bg-slate-200" />
      {dashboard && <div className="grid gap-5 md:grid-cols-3">{[0, 1, 2].map(item => <div key={item} className="h-40 rounded-xl border border-slate-200 bg-white" />)}</div>}
      <div className="h-56 rounded-xl border border-slate-200 bg-white" />
    </div>
  </section>;
}

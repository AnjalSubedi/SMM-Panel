export default function Brand() {
  return (
    <a
      href="/"
      aria-label="Digital Marketing NP home"
      className="brand-identity group inline-flex shrink-0 items-center gap-2.5 sm:gap-3"
    >
      <svg
        viewBox="0 0 44 44"
        width="44"
        height="44"
        aria-hidden="true"
        className="size-10 shrink-0 sm:size-11"
      >
        <path d="M3 40V29h7v11H3Zm12 0V23h7v17h-7Zm12 0V17h7v23h-7Z" fill="#0F172A" />
        <path
          d="m4 22 11-11 9 7L38 4M27 4h11v11"
          fill="none"
          stroke="#2563EB"
          strokeWidth="4"
          strokeLinejoin="miter"
        />
      </svg>
      <span className="block">
        <span className="block text-[15px] font-extrabold leading-[1.08] tracking-[-0.045em] text-slate-900 sm:text-[21px]">
          <span className="block sm:inline">Digital </span>
          <span>Marketing <span className="text-blue-600">NP</span></span>
        </span>
        <span className="mt-1.5 hidden text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500 min-[400px]:block sm:text-[9px]">
          Social media services in Nepal
        </span>
      </span>
    </a>
  );
}

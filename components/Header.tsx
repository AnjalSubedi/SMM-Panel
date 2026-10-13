import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import Brand from "./Brand";
import AccountNav from "./AccountNav";
import { supportUrl } from "../config/site";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="page-container flex h-20 items-center justify-between gap-3 sm:h-[88px]">
        <Brand />
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-4 lg:gap-5">
          <Link href="/services#calculator" className="hidden text-[13px] font-semibold text-slate-600 transition-colors hover:text-blue-600 lg:block">
            Services &amp; prices
          </Link>
          <Link href="/services#packages" className="hidden text-[13px] font-semibold text-slate-600 transition-colors hover:text-blue-600 lg:block">
            Packages
          </Link>
          <Link href="/services#web-development" className="hidden text-[13px] font-semibold text-slate-600 transition-colors hover:text-blue-600 xl:block">
            Website design
          </Link>
          <span aria-hidden="true" className="hidden h-5 w-px bg-slate-200 xl:block" />
          <a href={supportUrl} className="hidden items-center gap-1.5 text-[13px] font-semibold text-slate-600 transition-colors hover:text-blue-600 xl:inline-flex">
            <MessageCircle size={15} aria-hidden="true" />
            Contact us
          </a>
          <Link href="/services#calculator" className="button-primary hidden min-h-11 sm:inline-flex px-3.5 text-xs sm:px-4 sm:text-[13px]">
            <span className="hidden sm:inline">Browse services</span>
            <span className="sm:hidden">Services</span>
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <AccountNav />
        </nav>
      </div>
    </header>
  );
}

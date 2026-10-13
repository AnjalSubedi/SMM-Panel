import Brand from "./Brand";
import { supportUrl } from "../config/site";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-12">
      <div className="page-container">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div><Brand /><p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">Social media services and website design for creators and businesses in Nepal.</p></div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-start gap-6 text-sm font-medium text-slate-600">
            <a href="/services#calculator" className="hover:text-blue-600">Services &amp; prices</a><a href="/services#packages" className="hover:text-blue-600">Packages</a><a href="/services#web-development" className="hover:text-blue-600">Website design</a><a href={supportUrl} className="hover:text-blue-600">Contact us</a>
          </nav>
        </div>
        <div className="mt-9 flex flex-col justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-600 sm:flex-row">
          <p>© {new Date().getFullYear()} Digital Marketing NP. All rights reserved.</p>
          <p>Based in Nepal · Prices in NPR</p>
        </div>
      </div>
    </footer>
  );
}

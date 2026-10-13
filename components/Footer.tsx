"use client";

import { useEffect, useState } from "react";
import Brand from "./Brand";
import { supportUrl } from "../config/site";

export default function Footer() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/services", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        setStatus(Array.isArray(data.services) && data.services.length > 0 ? "online" : "offline");
      })
      .catch(() => { if (!controller.signal.aborted) setStatus("offline"); });
    return () => controller.abort();
  }, []);
  return (
    <footer className="border-t border-slate-200 bg-slate-100 py-12">
      <div className="page-container">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div><Brand /><p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">Built for Nepal&apos;s next generation of creators, independent businesses, and digital brands.</p></div>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-start gap-6 text-sm font-medium text-slate-600">
            <a href="/services#calculator" className="hover:text-blue-600">Services</a><a href="/services#packages" className="hover:text-blue-600">Packages</a><a href="/services#web-development" className="hover:text-blue-600">Web development</a><a href={supportUrl} className="hover:text-blue-600">Contact</a>
          </nav>
        </div>
        <div className="mt-9 flex flex-col justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Digital Marketing NP. All rights reserved.</p>
          <p role="status" className="flex items-center gap-2"><span className={`size-2 rounded-full ${status === "online" ? "bg-emerald-500" : "bg-amber-500"}`} />{status === "online" ? "Service catalog operational" : status === "checking" ? "Checking catalog status" : "Catalog status unavailable"}</p>
        </div>
      </div>
    </footer>
  );
}

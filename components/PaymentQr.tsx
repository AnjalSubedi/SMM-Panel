"use client";
import { useState } from "react";
import { Copy, QrCode } from "lucide-react";
import { site } from "../config/site";

export default function PaymentQr() {
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  return <div className="flex flex-col items-center gap-4 rounded-md border border-zinc-200 bg-white p-4 sm:flex-row sm:items-start">
    <div className="w-44 max-w-full shrink-0 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-center">
      {!failed && site.esewaQrUrl ? <><img src={site.esewaQrUrl} width={1080} height={999} alt="eSewa payment QR" onError={() => setFailed(true)} className="h-auto w-full" /><a href={site.esewaQrUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block py-1 text-xs font-semibold text-blue-600">Open full-size QR</a></> : <p className="p-4 text-xs text-zinc-500"><QrCode size={28} className="mx-auto mb-2" />QR unavailable. Please contact support.</p>}
    </div>
    <div className="min-w-0 flex-1"><p className="text-sm font-bold text-emerald-700">Pay with eSewa</p><p className="mt-2 text-xs leading-6 text-zinc-500">Scan the QR in your eSewa app and pay the exact amount. Keep the transaction reference for verification.</p>{site.esewaId && <div className="mt-3 break-all rounded-md border border-zinc-200 bg-zinc-50 p-2 font-mono text-xs"><span>{site.esewaId}</span><button type="button" aria-label="Copy eSewa ID" onClick={async () => { try { await navigator.clipboard.writeText(site.esewaId); setCopied(true); } catch { setCopied(false); } }} className="ml-2 inline-flex p-1 text-blue-600"><Copy size={13} /></button>{copied && <p role="status" className="mt-1 font-sans text-emerald-700">Copied</p>}</div>}</div>
  </div>;
}

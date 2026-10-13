"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { authClient } from "../lib/auth-client";
export default function AccountActions() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="text-right"><button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const response = await authClient.signOut(); if (response.error) throw new Error(); window.location.assign("/login"); } catch { setError("Unable to sign out. Try again."); setBusy(false); } }} className="button-secondary min-h-10 px-3 text-xs"><LogOut size={14} aria-hidden="true" />{busy ? "Signing out..." : "Sign out"}</button>{error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}</div>;
}

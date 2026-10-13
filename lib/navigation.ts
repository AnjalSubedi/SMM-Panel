export function safeNext(value?: string): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/account";
  try { const url = new URL(value, "https://local.invalid"); return url.origin === "https://local.invalid" && !url.pathname.startsWith("/api/") ? url.pathname + url.search + url.hash : "/account"; }
  catch { return "/account"; }
}

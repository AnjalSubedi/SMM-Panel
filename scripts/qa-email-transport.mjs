// Explicitly loaded by the disposable QA process, never by application code.
import { appendFileSync } from "node:fs";
const database = new URL(process.env.QA_DATABASE_URL || "");
if (database.hostname !== "127.0.0.1" || database.username !== "dmnp_test" || database.pathname !== "/dmnp_qa" || process.env.RESEND_API_KEY !== "isolated-qa-mail-key" || !process.env.QA_MAILBOX_FILE) throw new Error("Email transport is restricted to disposable local QA.");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const target = new URL(typeof url === "string" ? url : url instanceof URL ? url.href : url.url);
  if (target.href === "https://api.resend.com/emails") {
    appendFileSync(process.env.QA_MAILBOX_FILE, JSON.stringify(JSON.parse(typeof init?.body === "string" ? init.body : url instanceof Request ? await url.clone().text() : String(init?.body))) + "\n", { mode: 0o600 });
    return Response.json({ id: "isolated-mock-email" });
  }
  if (!["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("External calls are forbidden during email QA.");
  return originalFetch(url, init);
};

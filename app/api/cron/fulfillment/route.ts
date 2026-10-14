import { cronAuthorized, runFulfillment } from "../../../../lib/server/fulfillment";
import { json } from "../../../../lib/server/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers)) return json({ error: "Unauthorized" }, 401);
  await runFulfillment(); return json({ ok: true });
}

import { z } from "zod";
import { api, authenticated, body, json, rateLimit } from "../../../../lib/server/http";
import { reconcileProviderOrder } from "../../../../lib/server/fulfillment";
import { scheduleFulfillment } from "../../../../lib/server/schedule-fulfillment";
import { AppError } from "../../../../lib/server/errors";
export const runtime = "nodejs";
export const maxDuration = 60;
const schema = z.object({ orderId: z.string().uuid(), jobId: z.string().uuid(), providerOrderId: z.string().regex(/^[1-9][0-9]{0,19}$/) }).strict();
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request, true); const input = await body(request, schema);
  await rateLimit("fulfillment-review:" + user.id, 15);
  try { await reconcileProviderOrder(input.orderId, input.jobId, input.providerOrderId, user.id); }
  catch { throw new AppError("The reference could not be linked. Check that it belongs to this order and has not been used already.", 409); }
  scheduleFulfillment({ orderId: input.orderId }); return json({ ok: true });
}); }

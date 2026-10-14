import { scheduleFulfillment } from "../../../../lib/server/schedule-fulfillment";
import { api, authenticated, body, json, rateLimit } from "../../../../lib/server/http";
import { reviewPayment, reviewSchema } from "../../../../lib/server/commerce";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request, true);
  const input = await body(request, reviewSchema);
  await rateLimit("admin-review:" + user.id, 60);
  const result = await reviewPayment(input, user.id); if (result.status === "approved" && result.orderId) scheduleFulfillment({ orderId: result.orderId }); return json(result);
}); }

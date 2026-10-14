import { scheduleFulfillment } from "../../../../../lib/server/schedule-fulfillment";
import { api, authenticated, body, json, rateLimit } from "../../../../../lib/server/http";
import { chooseDelivery, deliverySchema } from "../../../../../lib/server/commerce";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request);
  const input = await body(request, deliverySchema);
  await rateLimit("delivery:" + user.id, 15);
  const result = await chooseDelivery(input, user); scheduleFulfillment({ orderId: result.id }); return json(result);
}); }

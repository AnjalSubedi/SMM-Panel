import { scheduleFulfillment } from "../../../lib/server/schedule-fulfillment";
import { guestOrderLimitKey } from "../../../lib/server/request-security";
import { api, body, json, rateLimit } from "../../../lib/server/http";
import { currentUser } from "../../../lib/server/access";
import { createOrder, orderSchema } from "../../../lib/server/commerce";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return api(async () => {
  const input = await body(request, orderSchema);
  const user = await currentUser(request.headers);
  await rateLimit(user ? "order:" + user.id : guestOrderLimitKey(request.headers), user ? 15 : 30);
  const result = await createOrder(input, user); if (result.status === "queued") scheduleFulfillment({ orderId: result.id }); return json(result, 201);
}); }

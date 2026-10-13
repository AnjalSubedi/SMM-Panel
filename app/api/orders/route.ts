import { api, body, json, rateLimit } from "../../../lib/server/http";
import { currentUser } from "../../../lib/server/access";
import { createOrder, orderSchema } from "../../../lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(async () => {
  const input = await body(request, orderSchema);
  const user = await currentUser(request.headers);
  rateLimit(user ? "order:" + user.id : "guest-orders", user ? 15 : 30);
  return json(createOrder(input, user), 201);
}); }

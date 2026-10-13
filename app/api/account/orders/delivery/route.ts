import { api, authenticated, body, json, rateLimit } from "../../../../../lib/server/http";
import { chooseDelivery, deliverySchema } from "../../../../../lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request);
  const input = await body(request, deliverySchema);
  rateLimit("delivery:" + user.id, 15);
  return json(chooseDelivery(input, user));
}); }

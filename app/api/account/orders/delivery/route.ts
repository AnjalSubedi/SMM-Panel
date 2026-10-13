import { api, authenticated, body, json, rateLimit } from "../../../../../lib/server/http";
import { chooseDelivery, deliverySchema } from "../../../../../lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request);
  const input = await body(request, deliverySchema);
  await rateLimit("delivery:" + user.id, 15);
  return json(await chooseDelivery(input, user));
}); }

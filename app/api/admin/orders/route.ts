import { api, authenticated, body, json, rateLimit } from "../../../../lib/server/http";
import { statusSchema, updateOrderStatus } from "../../../../lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request, true);
  const input = await body(request, statusSchema);
  rateLimit("admin-order:" + user.id, 60);
  return json(updateOrderStatus(input, user.id));
}); }

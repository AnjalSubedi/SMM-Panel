import { api, authenticated, body, json, rateLimit } from "../../../../lib/server/http";
import { reviewPayment, reviewSchema } from "../../../../lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request, true);
  const input = await body(request, reviewSchema);
  rateLimit("admin-review:" + user.id, 60);
  return json(reviewPayment(input, user.id));
}); }

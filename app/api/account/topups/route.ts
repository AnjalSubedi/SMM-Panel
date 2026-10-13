import { api, authenticated, body, json, rateLimit } from "../../../../lib/server/http";
import { requestTopup, topupSchema } from "../../../../lib/server/commerce";
export const runtime = "nodejs";
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request);
  const input = await body(request, topupSchema);
  await rateLimit("topup:" + user.id, 8);
  return json(await requestTopup(input, user), 201);
}); }

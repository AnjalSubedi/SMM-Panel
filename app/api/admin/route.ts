import { api, authenticated, json, rateLimit } from "../../../lib/server/http";
import { adminData } from "../../../lib/server/commerce";
export const runtime = "nodejs";
export async function GET(request: Request) { return api(async () => { const user = await authenticated(request, true); await rateLimit("admin-read:" + user.id, 60); return json(await adminData(user.id)); }); }

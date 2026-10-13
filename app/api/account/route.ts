import { api, authenticated, json, rateLimit } from "../../../lib/server/http";
import { accountData } from "../../../lib/server/commerce";
export const runtime = "nodejs";
export async function GET(request: Request) { return api(async () => { const user = await authenticated(request); await rateLimit("account-read:" + user.id, 90); return json(await accountData(user)); }); }

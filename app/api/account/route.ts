import { api, authenticated, json } from "../../../lib/server/http";
import { accountData } from "../../../lib/server/commerce";
export const runtime = "nodejs";
export async function GET(request: Request) { return api(async () => json(accountData(await authenticated(request)))); }

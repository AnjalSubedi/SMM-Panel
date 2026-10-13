import { api, authenticated, json } from "../../../lib/server/http";
import { adminData } from "../../../lib/server/commerce";
export const runtime = "nodejs";
export async function GET(request: Request) { return api(async () => json(await adminData((await authenticated(request, true)).id))); }

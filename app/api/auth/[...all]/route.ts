import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "../../../../lib/server/auth";
import { api } from "../../../../lib/server/http";
import { readLimitedBody } from "../../../../lib/server/request-security";
export const runtime = "nodejs";
async function handle(request: Request, method: "GET" | "POST") {
  return api(async () => {
    if (method === "POST") {
      const bytes = await readLimitedBody(request);
      const headers = new Headers(request.headers); headers.delete("content-length");
      request = new Request(request, { headers, body: new Uint8Array(bytes) });
    }
    const response = await toNextJsHandler(await getAuth())[method](request);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  });
}
export function GET(request: Request) { return handle(request, "GET"); }
export function POST(request: Request) { return handle(request, "POST"); }

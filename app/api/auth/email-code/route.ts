import { api, body, json } from "../../../../lib/server/http";
import { emailCodeSchema, handleEmailCode } from "../../../../lib/server/email-code";

export async function POST(request: Request) {
  const response = await api(async () => json(await handleEmailCode(await body(request, emailCodeSchema), request.headers)));
  if (response.status === 429) response.headers.set("Retry-After", "60");
  return response;
}

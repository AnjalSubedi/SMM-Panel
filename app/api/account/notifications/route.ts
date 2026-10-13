import { api, authenticated, body, json, rateLimit } from "../../../../lib/server/http";
import { markNotificationsRead, notificationData, notificationReadSchema } from "../../../../lib/server/notifications";
export const runtime = "nodejs";
export async function GET(request: Request) { return api(async () => { const user = await authenticated(request); await rateLimit("notification-list:" + user.id, 90); return json(await notificationData(user)); }); }
export async function POST(request: Request) { return api(async () => {
  const user = await authenticated(request);
  const input = await body(request, notificationReadSchema);
  await rateLimit("notification-read:" + user.id, 60);
  return json(await markNotificationsRead(input, user));
}); }

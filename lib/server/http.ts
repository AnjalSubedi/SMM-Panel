import "server-only";
import { z } from "zod";
import { getDb } from "./db";
import { currentUser } from "./access";

import { AppError } from "./errors";
export { AppError } from "./errors";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function api(work: () => Promise<Response> | Response): Promise<Response> {
  try { return await work(); }
  catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message || "Invalid request." }, 400);
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400);
    console.error("Account request failed:", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "The request could not be completed. Please try again." }, 500);
  }
}

export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.BETTER_AUTH_URL || request.url).origin;
  if (!origin || origin !== expected) throw new AppError("Request origin is not allowed.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new AppError("Use a JSON request.", 415);
  const text = await request.text();
  if (text.length > 20000) throw new AppError("Request is too large.", 413);
  return schema.parse(JSON.parse(text));
}

export async function authenticated(request: Request, admin = false) {
  const user = await currentUser(request.headers);
  if (!user) throw new AppError("Please sign in to continue.", 401);
  if (admin && !user.isAdmin) throw new AppError("Administrator access is required.", 403);
  return user;
}

export async function rateLimit(key: string, max = 15) {
  const db = getDb();
  const bucket = Math.floor(Date.now() / 60000);
  const result = await db.query<{ count: number }>('INSERT INTO "appLimit" (key,bucket,count) VALUES ($1,$2,1) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "appLimit".bucket = EXCLUDED.bucket THEN "appLimit".count + 1 ELSE 1 END, bucket = EXCLUDED.bucket RETURNING count', [key, bucket]);
  if (result.rows[0].count > max) throw new AppError("Too many requests. Please wait a minute.", 429);
}

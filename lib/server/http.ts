import "server-only";
import { z } from "zod";
import { getDb } from "./db";
import { authOrigin, readLimitedBody } from "./request-security";

import { AppError } from "./errors";
export { AppError } from "./errors";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function api(work: () => Promise<Response> | Response): Promise<Response> {
  try { return await work(); }
  catch (error) {
    if (error instanceof AppError) {
      const response = json({ error: error.message }, error.status);
      if (error.status === 429) response.headers.set("Retry-After", String(Math.ceil((60000 - Date.now() % 60000) / 1000)));
      return response;
    }
    if (error instanceof z.ZodError) return json({ error: error.issues[0]?.message || "Invalid request." }, 400);
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400);
    console.error("Account request failed:", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "The request could not be completed. Please try again." }, 500);
  }
}

export async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const origin = request.headers.get("origin");
  const expected = authOrigin();
  if (!origin || origin !== expected) throw new AppError("Request origin is not allowed.", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError("Use a JSON request.", 415);
  const bytes = await readLimitedBody(request);
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new AppError("Use valid UTF-8 JSON.", 400); }
  return schema.parse(JSON.parse(text));
}

export async function authenticated(request: Request, admin = false) {
  const { currentUser } = await import("./access");
  const user = await currentUser(request.headers);
  if (!user) throw new AppError("Please sign in to continue.", 401);
  if (admin && !user.isAdmin) throw new AppError("Administrator access is required.", 403);
  return user;
}

const cleanupState = globalThis as typeof globalThis & { dmnpLimitCleanupAt?: number };
export async function rateLimit(key: string, max = 15) {
  const db = getDb();
  const bucket = Math.floor(Date.now() / 60000);
  const result = await db.query<{ count: number }>('INSERT INTO "appLimit" (key,bucket,count) VALUES ($1,$2,1) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "appLimit".bucket = EXCLUDED.bucket THEN LEAST("appLimit".count, $3 - 1) + 1 ELSE 1 END, bucket = EXCLUDED.bucket RETURNING count', [key, bucket, max + 1]);
  if (Date.now() - (cleanupState.dmnpLimitCleanupAt || 0) > 300000) {
    cleanupState.dmnpLimitCleanupAt = Date.now();
    // Bound cleanup work and retention; a traffic spike cannot create a huge single deletion.
    await db.query('DELETE FROM "appLimit" WHERE key IN (SELECT key FROM "appLimit" WHERE bucket < $1 LIMIT 1000)', [bucket - 1440]).catch(() => { cleanupState.dmnpLimitCleanupAt = 0; });
  }
  if (result.rows[0].count > max) throw new AppError("Too many requests. Please wait a minute.", 429);
}

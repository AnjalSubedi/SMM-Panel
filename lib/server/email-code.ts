import "server-only";
import { createHash } from "node:crypto";
import { isAPIError } from "better-auth/api";
import { z } from "zod";
import { getAuth, sendEmailVerificationCode } from "./auth";
import { getDb } from "./db";
import { AppError, rateLimit } from "./http";
import { guestOrderLimitKey } from "./request-security";

export const emailCodeSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), email: z.email().max(254).trim(), password: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("verify"), email: z.email().max(254).trim(), password: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/, "Enter the six-digit code from your email.") }).strict(),
]);

export async function handleEmailCode(input: z.infer<typeof emailCodeSchema>, headers: Headers) {
  const email = input.email.toLowerCase();
  const emailKey = createHash("sha256").update(email).digest("hex");
  await rateLimit("email-code:ip:" + guestOrderLimitKey(headers), 30);
  await rateLimit("email-code:attempt:" + emailKey, 10);
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.AUTH_EMAIL_FROM?.trim()) throw new AppError("Email verification is unavailable right now. Please try Google or contact us.", 503);
  const auth = await getAuth();
  const context = await auth.$context;
  const record = await context.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const credential = record?.accounts.find(account => account.providerId === "credential" && account.accountId === record.user.id);
  // Require the signup password as well as the mailbox code. An email code on its
  // own must not activate a password previously chosen by someone else.
  const valid = credential?.password ? await context.password.verify({ hash: credential.password, password: input.password }) : (await context.password.hash(input.password), false);
  if (!record || !valid) throw new AppError("Email or password is incorrect. Try signing in, or reset your password.", 401);
  if (record.user.emailVerified) {
    if (input.action === "verify") throw new AppError("This email is already verified. Please sign in.", 409);
    return { success: true, alreadyVerified: true };
  }
  if (input.action === "send") {
    // A database primary key makes this cooldown hold across browsers and Vercel instances.
    const cooldown = "email-code-cooldown:" + emailKey;
    await getDb().query('DELETE FROM "verification" WHERE identifier = $1 AND "expiresAt" <= NOW()', [cooldown]);
    if (!await context.internalAdapter.reserveVerificationValue({ identifier: cooldown, value: "reserved", expiresAt: new Date(Date.now() + 60000) })) throw new AppError("Please wait 60 seconds before requesting another code.", 429);
    await context.internalAdapter.deleteVerificationByIdentifier("email-verification-otp-" + email);
    try {
      // Better Auth treats email callbacks as background work and swallows transport
      // errors. Generate securely through the plugin, but await delivery ourselves.
      const otp = await auth.api.createVerificationOTP({ body: { email, type: "email-verification" } });
      await sendEmailVerificationCode(email, otp);
    } catch {
      await context.internalAdapter.deleteVerificationByIdentifier("email-verification-otp-" + email);
      throw new AppError("We couldn't send the code. Wait a minute and try again, or contact us.", 503);
    }
    return { success: true };
  }
  try {
    await auth.api.verifyEmailOTP({ body: { email, otp: input.code } });
    return { success: true };
  } catch (error) {
    if (isAPIError(error)) {
      const code = error.body?.code;
      const message = code === "TOO_MANY_ATTEMPTS" ? "Too many incorrect attempts. Request a new code." : code === "OTP_EXPIRED" || code === "OTP_NOT_FOUND" ? "This code has expired or was already used. Request a new code." : "That code is incorrect. Check your email and try again.";
      throw new AppError(message, 400);
    }
    throw error;
  }
}

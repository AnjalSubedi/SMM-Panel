import "server-only";
import { APIError } from "better-auth/api";
import { authOrigin, trustedIpHeaders } from "./request-security";
import { isPublicWebLink } from "../publicLinks";
import { betterAuth } from "better-auth";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { getDb } from "./db";

export const adminEmail = (process.env.ADMIN_EMAIL || "digitalmarketingnp0@gmail.com").trim().toLowerCase();

function secret(): string {
  if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 32) return process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "production") throw new Error("Set a unique BETTER_AUTH_SECRET of at least 32 characters before starting production.");
  mkdirSync(".runtime", { recursive: true });
  const filename = ".runtime/auth-secret";
  if (!existsSync(filename)) writeFileSync(filename, randomBytes(48).toString("base64url"), { mode: 0o600, flag: "wx" });
  return readFileSync(filename, "utf8");
}

function authSettings() {
  return {
    baseURL: authOrigin(),
    secret: secret(),
    googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || "",
    emailApiKey: process.env.RESEND_API_KEY?.trim() || "",
    emailFrom: process.env.AUTH_EMAIL_FROM?.trim() || "",
    production: process.env.NODE_ENV === "production",
    ipAddressHeaders: trustedIpHeaders(),
    databaseUrl: process.env.DATABASE_URL?.trim() || "",
  };
}
type AuthSettings = ReturnType<typeof authSettings>;

async function sendAuthEmail(settings: AuthSettings, to: string, subject: string, url: string) {
  if (!settings.emailApiKey || !settings.emailFrom) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + settings.emailApiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: settings.emailFrom, to: [to], subject, text: subject + "\n\n" + url + "\n\nIf you did not request this, ignore this message." }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Unable to send account email. Please try again later.");
}

function safeProfile(user: { name?: unknown; image?: unknown }): { name?: string; image?: string | null } {
  const fields: { name?: string; image?: string | null } = {};
  if (user.name !== undefined) {
    if (typeof user.name !== "string" || !user.name.trim() || user.name.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(user.name)) throw new APIError("BAD_REQUEST", { message: "Use a display name between 1 and 80 characters." });
    fields.name = user.name.trim();
  }
  if (user.image !== undefined) {
    if (user.image !== null && (typeof user.image !== "string" || !isPublicWebLink(user.image))) throw new APIError("BAD_REQUEST", { message: "Use a public HTTP(S) profile image URL." });
    fields.image = user.image as string | null;
  }
  return fields;
}
function buildAuth(settings: AuthSettings) {
  const googleConfigured = Boolean(settings.googleClientId && settings.googleClientSecret);
  const emailConfigured = Boolean(settings.emailApiKey && settings.emailFrom);
  return betterAuth({
    appName: "Digital Marketing NP",
    baseURL: settings.baseURL,
    secret: settings.secret,
    database: getDb(),
    trustedOrigins: [settings.baseURL],
    // Google is used for identity only; no feature needs ongoing Google API access.
    account: { accountLinking: { enabled: true, requireLocalEmailVerified: true, allowDifferentEmails: false, allowUnlinkingAll: false }, storeAccountCookie: false },
    databaseHooks: {
      user: {
        create: { before: async user => ({ data: { ...user, ...safeProfile(user) } }) },
        update: { before: async user => ({ data: { ...user, ...safeProfile(user) } }) },
      },
      account: {
        create: { before: async account => ({ data: account.providerId === "google" ? { ...account, accessToken: null, refreshToken: null, idToken: null } : account }) },
        update: { before: async account => {
          // OAuth callback, implicit link and refresh all persist through these hooks.
          if (account.accessToken !== undefined || account.refreshToken !== undefined || account.idToken !== undefined) return { data: { ...account, accessToken: null, refreshToken: null, idToken: null } };
        } },
      },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: settings.production && !emailConfigured,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: settings.production || emailConfigured,
      revokeSessionsOnPasswordReset: true,
      ...(emailConfigured ? { sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => sendAuthEmail(settings, user.email, "Reset your Digital Marketing NP password", url) } : {}),
    },
    emailVerification: {
      sendOnSignUp: emailConfigured,
      autoSignInAfterVerification: true,
      ...(emailConfigured ? { sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => sendAuthEmail(settings, user.email, "Verify your Digital Marketing NP email", url) } : {}),
    },
    socialProviders: googleConfigured ? {
      google: { clientId: settings.googleClientId, clientSecret: settings.googleClientSecret, prompt: "select_account" },
    } : {},
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60, customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 60, max: 5 }, "/request-password-reset": { window: 60, max: 3 } } },
    advanced: { cookiePrefix: "dmnp", useSecureCookies: settings.baseURL.startsWith("https://"), ipAddress: { ipAddressHeaders: settings.ipAddressHeaders }, defaultCookieAttributes: { httpOnly: true, sameSite: "lax" } },
  });
}

type AppAuth = ReturnType<typeof buildAuth>;
const state = globalThis as typeof globalThis & { dmnpAuth?: Promise<AppAuth>; dmnpAuthKey?: string };
export function getAuth(): Promise<AppAuth> {
  const settings = authSettings();
  // Next preserves globalThis across hot reloads, including .env.local updates.
  // Cache by a digest so changed OAuth settings replace the previous instance.
  const key = createHash("sha256").update(JSON.stringify(settings)).digest("hex");
  if (!state.dmnpAuth || state.dmnpAuthKey !== key) {
    const previous = state.dmnpAuth;
    const pending = (async () => {
      // Finish initialization before replacing changed settings.
      if (previous) await previous.catch(() => undefined);
      const auth = buildAuth(settings);
      return auth;
    })().catch((error) => {
      if (state.dmnpAuth === pending) {
        state.dmnpAuth = undefined;
        state.dmnpAuthKey = undefined;
      }
      throw error;
    });
    state.dmnpAuthKey = key;
    state.dmnpAuth = pending;
  }
  return state.dmnpAuth;
}

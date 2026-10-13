import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { isAdminId } from "./permissions";
import type { AccountUser } from "../account-types";

export async function currentUser(requestHeaders?: Headers): Promise<AccountUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders ?? await headers(), query: { disableCookieCache: true } });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, emailVerified: session.user.emailVerified, isAdmin: await isAdminId(session.user.id) };
}

export async function requireUserPage(admin = false, next = admin ? "/admin" : "/account"): Promise<AccountUser> {
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent(next));
  if (admin && !user.isAdmin) redirect("/account?notice=admin-only");
  return user;
}

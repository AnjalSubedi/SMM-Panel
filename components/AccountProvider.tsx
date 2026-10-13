"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { authClient } from "../lib/auth-client";
import type { NotificationData } from "../lib/notification-types";

type SessionState = ReturnType<typeof authClient.useSession>;
type AccountContextValue = {
  session: SessionState["data"]; sessionPending: boolean; notifications: NotificationData | null;
  notificationsPending: boolean; notificationError: string; refreshNotifications: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
};
const AccountContext = createContext<AccountContextValue | null>(null);
export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("AccountProvider is required.");
  return value;
}
export default function AccountProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id;
  const owner = useRef(userId); owner.current = userId;
  const controller = useRef<AbortController | null>(null);
  const [snapshot, setSnapshot] = useState<{ userId: string; data: NotificationData } | null>(null);
  const [notificationsPending, setPending] = useState(false);
  const [notificationError, setError] = useState("");
  const refreshNotifications = useCallback(async () => {
    controller.current?.abort();
    if (!userId) return;
    const request = new AbortController(); controller.current = request; setPending(true);
    try {
      const response = await fetch("/api/account/notifications", { cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error();
      const data: NotificationData = await response.json();
      if (!request.signal.aborted && owner.current === userId) { setSnapshot({ userId, data }); setError(""); }
    } catch { if (!request.signal.aborted && owner.current === userId) setError("Unable to load notifications. Please try again."); }
    finally { if (!request.signal.aborted && owner.current === userId) setPending(false); }
  }, [userId]);
  useEffect(() => {
    setSnapshot(null); setError(""); setPending(false);
    void refreshNotifications();
    const onFocus = () => { if (!document.hidden) void refreshNotifications(); };
    window.addEventListener("focus", onFocus);
    const timer = userId ? setInterval(onFocus, 60000) : undefined;
    return () => { controller.current?.abort(); window.removeEventListener("focus", onFocus); if (timer) clearInterval(timer); };
  }, [refreshNotifications, userId]);
  async function markRead(ids: string[]) {
    if (!userId || !ids.length) return;
    controller.current?.abort();
    try {
      const response = await fetch("/api/account/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("Unable to mark notifications as read. Please try again.");
      const data: NotificationData = await response.json();
      if (owner.current === userId) { setSnapshot({ userId, data }); setError(""); }
    } finally { if (owner.current === userId) setPending(false); }
  }
  return <AccountContext.Provider value={{ session, sessionPending, notifications: snapshot && snapshot.userId === userId ? snapshot.data : null, notificationsPending, notificationError, refreshNotifications, markRead }}>{children}</AccountContext.Provider>;
}

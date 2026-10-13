"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authClient } from "../lib/auth-client";
import type { NotificationData } from "../lib/notification-types";

type SessionState = ReturnType<typeof authClient.useSession>;
type AccountContextValue = {
  session: SessionState["data"]; sessionPending: boolean; notifications: NotificationData | null;
  notificationsPending: boolean; notificationError: string; refreshNotifications: (force?: boolean) => Promise<void>;
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
  const inFlight = useRef<{ userId: string; controller: AbortController; promise: Promise<void> } | null>(null);
  const lastFetched = useRef(0);
  const readQueue = useRef<Promise<void>>(Promise.resolve());
  const [snapshot, setSnapshot] = useState<{ userId: string; data: NotificationData } | null>(null);
  const [notificationsPending, setPending] = useState(false);
  const [notificationError, setError] = useState("");
  const cancelRefresh = useCallback(() => {
    inFlight.current?.controller.abort(); inFlight.current = null; setPending(false);
  }, []);
  const refreshNotifications = useCallback((force = true): Promise<void> => {
    if (!userId) return Promise.resolve();
    if (inFlight.current?.userId === userId && !force) return inFlight.current.promise;
    if (force) { inFlight.current?.controller.abort(); inFlight.current = null; }
    if (!force && Date.now() - lastFetched.current < 15000) return Promise.resolve();
    const controller = new AbortController();
    setPending(true);
    const promise = (async () => {
      try {
        const response = await fetch("/api/account/notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data: NotificationData = await response.json();
        if (!controller.signal.aborted && owner.current === userId) {
          setSnapshot({ userId, data }); setError(""); lastFetched.current = Date.now();
        }
      } catch { if (!controller.signal.aborted && owner.current === userId) setError("Unable to load notifications. Please try again."); }
      finally {
        if (inFlight.current?.controller === controller) { inFlight.current = null; setPending(false); }
      }
    })();
    inFlight.current = { userId, controller, promise };
    return promise;
  }, [userId]);
  useEffect(() => {
    setSnapshot(null); setError(""); setPending(false); lastFetched.current = 0;
    void refreshNotifications();
    const onFocus = () => { if (!document.hidden) void refreshNotifications(false); };
    window.addEventListener("focus", onFocus);
    const timer = userId ? setInterval(onFocus, 60000) : undefined;
    return () => {
      inFlight.current?.controller.abort(); inFlight.current = null;
      window.removeEventListener("focus", onFocus); if (timer) clearInterval(timer);
    };
  }, [refreshNotifications, userId]);
  const markRead = useCallback((ids: string[]): Promise<void> => {
    if (!userId || !ids.length) return Promise.resolve();
    // Serialize clicks from the popup and dashboard so older responses cannot undo newer reads.
    const task = readQueue.current.catch(() => undefined).then(async () => {
      if (owner.current !== userId) return;
      cancelRefresh();
      const response = await fetch("/api/account/notifications", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) throw new Error("Unable to mark notifications as read. Please try again.");
      const data: NotificationData = await response.json();
      if (owner.current === userId) {
        // A refresh started during this write must not restore an older unread badge.
        cancelRefresh();
        setSnapshot({ userId, data }); setError(""); lastFetched.current = Date.now();
      }
    });
    readQueue.current = task.catch(() => undefined);
    return task;
  }, [userId, cancelRefresh]);
  const value = useMemo(() => ({ session, sessionPending, notifications: snapshot && snapshot.userId === userId ? snapshot.data : null, notificationsPending, notificationError, refreshNotifications, markRead }), [session, sessionPending, snapshot, userId, notificationsPending, notificationError, refreshNotifications, markRead]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

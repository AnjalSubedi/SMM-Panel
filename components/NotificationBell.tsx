"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Bell, RefreshCw, X } from "lucide-react";
import { useAccount } from "./AccountProvider";
import NotificationCenter from "./NotificationCenter";

export default function NotificationBell({ onOpen }: { onOpen: () => void }) {
  const { notifications, notificationsPending, refreshNotifications } = useAccount();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 92, width: 432 });
  const unread = notifications?.unreadCount || 0;

  function positionPanel() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(432, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16));
    setPosition({ left, top: rect.bottom + 12, width });
  }
  function close(restoreFocus = true) {
    panel.current?.hidePopover();
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, { passive: true });
    return () => { window.removeEventListener("resize", positionPanel); window.removeEventListener("scroll", positionPanel); };
  }, [open]);

  return <>
    <button ref={trigger} type="button" data-notification-trigger aria-label={"Notifications" + (unread ? ", " + unread + " unread" : "")} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} popoverTarget={id} onClick={positionPanel} className={"relative flex size-10 items-center justify-center rounded-md border bg-white transition-colors " + (open ? "border-blue-200 bg-blue-50 text-blue-600" : "border-zinc-200 text-zinc-600 hover:border-blue-200 hover:text-blue-600")}>
      <Bell size={18} aria-hidden="true" />
      {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-md bg-blue-600 px-1 py-0.5 text-center font-mono text-[9px] font-bold leading-3 text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-labelledby={id + "-title"} data-notification-popover className="notification-popover m-0 overflow-hidden rounded-md border border-zinc-200 bg-white p-0 text-zinc-900 " style={{ position: "fixed", inset: "auto", ...position, maxHeight: "calc(100dvh - " + position.top + "px - 1rem)" }} onToggle={event => {
      const visible = event.currentTarget.matches(":popover-open");
      setOpen(visible);
      if (visible) { positionPanel(); onOpen(); void refreshNotifications(); heading.current?.focus({ preventScroll: true }); }
      else if (panel.current?.contains(document.activeElement)) trigger.current?.focus({ preventScroll: true });
    }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }} onBlur={event => { const next = event.relatedTarget; if (next instanceof Node && !event.currentTarget.contains(next) && next !== trigger.current) close(false); }}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div className="min-w-0"><h2 ref={heading} id={id + "-title"} tabIndex={-1} className="text-base font-bold tracking-tight outline-none">Notifications</h2><p className="mt-0.5 text-[11px] text-zinc-500">{unread ? unread + " unread update" + (unread === 1 ? "" : "s") : "Your order and wallet activity"}</p></div>
        <div className="flex shrink-0 gap-1"><button type="button" aria-label="Refresh notifications" disabled={notificationsPending} onClick={() => void refreshNotifications()} className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-50 hover:text-blue-600 disabled:opacity-50"><RefreshCw size={16} className={notificationsPending ? "animate-spin" : ""} aria-hidden="true" /></button><button type="button" aria-label="Close notifications" onClick={() => close()} className="flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"><X size={18} aria-hidden="true" /></button></div>
      </div>
      <NotificationCenter popup onNavigate={() => close(false)} />
      <a href="/account/notifications" onClick={() => close(false)} className="flex min-h-12 shrink-0 items-center justify-center gap-2 border-t border-zinc-100 px-4 py-3 text-xs font-semibold text-blue-600 hover:bg-blue-50">View all notifications<ArrowRight size={14} aria-hidden="true" /></a>
    </div>
  </>;
}

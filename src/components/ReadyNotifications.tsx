"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

type ReadyOrder = { orderId: string; orderNumber: number; tableNumber: string; readyAt: string };

export function ReadyNotifications() {
  const [toasts, setToasts] = useState<ReadyOrder[]>([]);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/waiter/notifications", { cache: "no-store" });
        const json = await res.json();
        if (cancelled || !json.ok) return;
        const fresh: ReadyOrder[] = json.data.filter((o: ReadyOrder) => !seen.current.has(o.orderId));
        fresh.forEach((o) => seen.current.add(o.orderId));
        if (fresh.length) setToasts((t) => [...t, ...fresh]);
      } catch {
        // Silent — next poll will retry.
      }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 z-50 space-y-2 w-72 max-w-[90vw]">
      {toasts.map((t) => (
        <div
          key={t.orderId}
          className="p-3.5 rounded-2xl bg-[rgba(10,32,24,0.85)] backdrop-blur-xl border border-emerald-500/40 text-emerald-100 flex items-start gap-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.5),0_0_20px_rgba(16,185,129,0.3)] animate-toast"
        >
          <Bell size={17} className="mt-0.5 shrink-0 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-white text-sm">Order #{t.orderNumber}</p>
            <p className="text-emerald-200 mt-0.5">Table {t.tableNumber} is ready for service</p>
          </div>
          <button
            onClick={() => setToasts((cur) => cur.filter((x) => x.orderId !== t.orderId))}
            className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 text-xs transition-colors"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

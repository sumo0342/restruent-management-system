"use client";

import { useEffect, useState, useCallback } from "react";

type OrderItem = { id: string; nameSnapshot: string; quantity: number; notes: string | null };
type KitchenOrder = {
  id: string;
  orderNumber: number;
  status: "PENDING" | "PREPARING";
  createdAt: string;
  customerNote: string | null;
  table: { number: string };
  waiter: { name: string };
  items: OrderItem[];
};

function minutesAgo(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function KitchenBoard() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kitchen/orders", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setOrders(json.data);
    } catch {
      // next poll retries
    }
  }, []);

  useEffect(() => {
    load();
    const dataInterval = setInterval(load, 3000);
    const clockInterval = setInterval(() => forceTick((t) => t + 1), 15000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, [load]);

  async function act(orderId: string, action: "start" | "ready") {
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}/${action}`, { method: "POST" });
      const json = await res.json();
      if (json.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  if (orders.length === 0) {
    return <p className="p-10 text-center text-white/40 text-lg">No active orders. New orders will appear here automatically.</p>;
  }

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-stagger">
      {orders.map((o, idx) => {
        const waiting = minutesAgo(o.createdAt);
        const urgent = waiting >= 15;
        const isParcel = o.customerNote?.includes("PARCEL");
        const cleanNote = o.customerNote?.replace(/\[(📦 PARCEL \/ TAKEAWAY|🍽️ DINE IN)\]\s*/g, "").trim();

        return (
          <div
            key={o.id}
            className={`kds-card rounded-2xl border p-5 ${
              idx === 0 ? "is-oldest border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)]" : "border-white/12"
            } ${
              urgent ? "is-urgent bg-orange-500/20 border-orange-500/80" : "bg-white/[0.04]"
            } ${
              isParcel ? "ring-1 ring-amber-400/40" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <p className="font-display text-xl font-bold text-white tracking-wide">Order #{o.orderNumber}</p>
                {isParcel ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                    📦 PARCEL / PACK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    🍽️ DINE IN
                  </span>
                )}
              </div>
              <span className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${
                urgent
                  ? "bg-rose-500/30 text-rose-200 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                  : "bg-white/10 text-slate-300 border-white/15"
              }`}>
                {waiting} min
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3.5 flex items-center gap-2">
              <span className="font-semibold text-slate-200">Table {o.table.number}</span>
              <span className="text-white/20">·</span>
              <span>Waiter: {o.waiter.name}</span>
            </p>
            <ul className="space-y-1.5 mb-4 text-base">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 p-1.5 rounded-lg bg-white/[0.03]">
                  <span className="font-medium text-slate-100">{i.quantity} × {i.nameSnapshot}</span>
                </li>
              ))}
            </ul>
            {(cleanNote || o.items.some((i) => i.notes) || isParcel) && (
              <div className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-xl space-y-1">
                {isParcel && (
                  <p className="font-bold text-amber-400 flex items-center gap-1">
                    <span>📦 PACKAGING:</span>
                    <span className="text-amber-200 font-normal">Pack order for takeaway / parcel</span>
                  </p>
                )}
                {cleanNote && <p><span className="font-semibold text-amber-400">Note:</span> {cleanNote}</p>}
                {o.items.filter((i) => i.notes).map((i) => (
                  <p key={i.id}><span className="font-semibold text-amber-400">{i.nameSnapshot}:</span> {i.notes}</p>
                ))}
              </div>
            )}
            {o.status === "PENDING" ? (
              <button
                onClick={() => act(o.id, "start")}
                disabled={busyId === o.id}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(245,158,11,0.35)] active:scale-[0.98] disabled:opacity-50 border border-white/30"
              >
                START PREPARING
              </button>
            ) : (
              <button
                onClick={() => act(o.id, "ready")}
                disabled={busyId === o.id}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:opacity-50 border border-white/30"
              >
                MARK READY
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

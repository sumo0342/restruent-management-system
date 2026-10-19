const STYLES: Record<string, string> = {
  AVAILABLE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
  OCCUPIED: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
  ORDER_PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
  FOOD_READY: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 shadow-[0_0_14px_rgba(16,185,129,0.3)]",
  WAITING_FOR_BILL: "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_14px_rgba(249,115,22,0.3)]",
  CLEANING: "bg-slate-400/15 text-slate-300 border-slate-400/25",

  PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
  PREPARING: "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-[0_0_14px_rgba(249,115,22,0.3)]",
  READY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_14px_rgba(16,185,129,0.3)]",
  SERVED: "bg-slate-400/15 text-slate-300 border-slate-400/25",
  CANCEL_REQUESTED: "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_14px_rgba(244,63,94,0.3)]",
  CANCELLED: "bg-white/5 text-slate-400 border-white/10",
  BILL_PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]",
  BILLED: "bg-slate-400/15 text-slate-300 border-slate-400/25",
  PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
  CLOSED: "bg-white/5 text-slate-400 border-white/10",

  OPEN: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  IN_PROGRESS: "bg-orange-500/20 text-orange-300 border-orange-500/35",
  COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  DONE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  LOW: "bg-slate-400/15 text-slate-300 border-slate-400/25",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  HIGH: "bg-orange-500/20 text-orange-300 border-orange-500/35",
  URGENT: "bg-rose-500/30 text-rose-200 border-rose-500/50 shadow-[0_0_16px_rgba(244,63,94,0.4)]",
};

// Statuses that represent something actively in motion right now
const LIVE_STATUSES = new Set([
  "ORDER_PENDING",
  "FOOD_READY",
  "WAITING_FOR_BILL",
  "PENDING",
  "PREPARING",
  "READY",
  "CANCEL_REQUESTED",
  "OPEN",
  "IN_PROGRESS",
]);

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`status-pill ${STYLES[status] ?? "bg-white/10 text-slate-200 border-white/20"} ${
        LIVE_STATUSES.has(status) ? "is-live" : ""
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

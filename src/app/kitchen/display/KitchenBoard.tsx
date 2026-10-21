"use client";

import { useEffect, useState, useCallback } from "react";
import { Printer, CheckCircle2, Clock, ChefHat, Eye, X, RefreshCw, AlertTriangle } from "lucide-react";

type OrderItem = { id: string; nameSnapshot: string; quantity: number; notes: string | null };
type KitchenOrder = {
  id: string;
  orderNumber: number;
  status: "PENDING" | "PREPARING";
  createdAt: string;
  customerNote: string | null;
  table: { number: string; section?: string | null };
  waiter: { name: string };
  restaurant?: { name: string };
  items: OrderItem[];
};

function minutesAgo(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function formatTicketDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function KitchenBoard() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  // Auto-print option for when chef marks order as ready/complete
  const [autoPrintOnReady, setAutoPrintOnReady] = useState<boolean>(true);
  const [printOrder, setPrintOrder] = useState<KitchenOrder | null>(null);
  const [previewOrder, setPreviewOrder] = useState<KitchenOrder | null>(null);

  // Load auto-print preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rms_kds_autoprint");
      if (saved !== null) {
        setAutoPrintOnReady(saved === "true");
      }
    } catch {}
  }, []);

  const toggleAutoPrint = (enabled: boolean) => {
    setAutoPrintOnReady(enabled);
    try {
      localStorage.setItem("rms_kds_autoprint", String(enabled));
    } catch {}
  };

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

  // Helper to trigger browser printing for a specific order
  const triggerPrint = useCallback((order: KitchenOrder) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 120);
  }, []);

  async function act(orderId: string, action: "start" | "ready", forcePrint: boolean = false) {
    setBusyId(orderId);
    const targetOrder = orders.find((o) => o.id === orderId);

    // If order is completed (ready), print slip if auto-print is enabled or forcePrint requested
    if (action === "ready" && (autoPrintOnReady || forcePrint) && targetOrder) {
      triggerPrint(targetOrder);
    }

    try {
      const res = await fetch(`/api/kitchen/orders/${orderId}/${action}`, { method: "POST" });
      const json = await res.json();
      if (json.ok) load();
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const preparingCount = orders.filter((o) => o.status === "PREPARING").length;

  return (
    <>
      {/* Print-specific style ensuring ONLY the KOT ticket is printed */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #kitchen-print-ticket,
              #kitchen-print-ticket * {
                visibility: visible !important;
              }
              #kitchen-print-ticket {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 8px !important;
                background: #ffffff !important;
                color: #000000 !important;
                display: block !important;
                z-index: 999999 !important;
                border: none !important;
                box-shadow: none !important;
              }
              @page {
                margin: 3mm;
                size: auto;
              }
            }
          `,
        }}
      />

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 print:hidden">
        {/* KDS Control Toolbar: Status Counters & Auto-Print Option */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
          {/* Status summary */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{orders.length} Active Orders</span>
            </div>
            {preparingCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-semibold">
                🔥 {preparingCount} Preparing
              </span>
            )}
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/25 text-sky-300 text-xs font-semibold">
                ⏳ {pendingCount} Pending
              </span>
            )}
          </div>

          {/* Chef Settings: Auto-Print on Order Complete Option */}
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-2 cursor-pointer select-none px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/15 transition-all text-xs font-medium text-slate-200"
              title="Automatically pop up print dialog with Table Number and Ordered Menu items when Chef marks order Ready"
            >
              <input
                type="checkbox"
                checked={autoPrintOnReady}
                onChange={(e) => toggleAutoPrint(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
              />
              <Printer size={15} className={autoPrintOnReady ? "text-emerald-400" : "text-slate-400"} />
              <span className="font-semibold">Auto-print on complete:</span>
              <span
                className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                  autoPrintOnReady
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/10 text-slate-400 border border-white/10"
                }`}
              >
                {autoPrintOnReady ? "ON" : "OFF"}
              </span>
            </label>

            <button
              onClick={() => load()}
              title="Refresh orders now"
              className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-300 transition-colors"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* Empty State */}
        {orders.length === 0 ? (
          <div className="p-16 text-center rounded-3xl border border-white/10 bg-white/[0.02]">
            <ChefHat size={44} className="mx-auto text-emerald-400/50 mb-3" />
            <p className="text-xl font-bold text-white mb-1">Kitchen Board Clear</p>
            <p className="text-sm text-slate-400">All orders are served. New orders from waiters will appear here automatically.</p>
          </div>
        ) : (
          /* Orders Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 animate-stagger">
            {orders.map((o, idx) => {
              const waiting = minutesAgo(o.createdAt);
              const urgent = waiting >= 15;
              const isParcel = o.customerNote?.includes("PARCEL");
              const cleanNote = o.customerNote?.replace(/\[(📦 PARCEL \/ TAKEAWAY|🍽️ DINE IN)\]\s*/g, "").trim();

              return (
                <div
                  key={o.id}
                  className={`kds-card rounded-2xl border p-5 relative transition-all ${
                    idx === 0 ? "is-oldest border-amber-500/80 shadow-[0_0_24px_rgba(245,158,11,0.25)]" : "border-white/12"
                  } ${
                    urgent ? "is-urgent bg-orange-500/20 border-orange-500/80" : "bg-white/[0.04]"
                  } ${
                    isParcel ? "ring-1 ring-amber-400/40" : ""
                  }`}
                >
                  {/* Top Bar: Order #, Service Type, Elapsed time, and Print Slip Button */}
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-xl font-bold text-white tracking-wide">Order #{o.orderNumber}</p>
                      {isParcel ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse">
                          📦 PARCEL
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          🍽️ DINE IN
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Manual Print Slip / Preview Button */}
                      <button
                        onClick={() => setPreviewOrder(o)}
                        title="Print / Preview Kitchen Slip (KOT) for this table"
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 hover:text-white transition-all active:scale-95 flex items-center gap-1 text-xs font-semibold"
                      >
                        <Printer size={14} className="text-emerald-400" />
                        <span className="hidden sm:inline">Slip</span>
                      </button>

                      <span
                        className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-full border ${
                          urgent
                            ? "bg-rose-500/30 text-rose-200 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                            : "bg-white/10 text-slate-300 border-white/15"
                        }`}
                      >
                        {waiting}m
                      </span>
                    </div>
                  </div>

                  {/* Prominent Table Number & Waiter info */}
                  <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 mb-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Assigned Table</span>
                      <span className="text-xl font-black text-amber-300 font-display tracking-wide">
                        Table {o.table.number}
                        {o.table.section ? ` (${o.table.section})` : ""}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">Waiter</span>
                      <span className="text-xs font-semibold text-slate-200">{o.waiter.name}</span>
                    </div>
                  </div>

                  {/* Ordered Menu Items List */}
                  <div className="mb-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Ordered Menu Items</span>
                      <span className="text-slate-500">
                        {o.items.reduce((sum, item) => sum + item.quantity, 0)} Total
                      </span>
                    </p>
                    <ul className="space-y-1.5 text-base">
                      {o.items.map((i) => (
                        <li
                          key={i.id}
                          className="flex items-start justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                          <div className="flex-1">
                            <span className="font-bold text-white text-[15px]">
                              {i.quantity} × {i.nameSnapshot}
                            </span>
                            {i.notes && (
                              <p className="text-xs text-amber-300/90 font-medium mt-0.5 pl-2 border-l-2 border-amber-400/50">
                                ↳ Note: {i.notes}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Special Notes & Packaging warning */}
                  {(cleanNote || isParcel) && (
                    <div className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 p-2.5 rounded-xl space-y-1">
                      {isParcel && (
                        <p className="font-bold text-amber-400 flex items-center gap-1">
                          <span>📦 PACKAGING:</span>
                          <span className="text-amber-200 font-normal">Pack order for takeaway / parcel</span>
                        </p>
                      )}
                      {cleanNote && (
                        <p>
                          <span className="font-semibold text-amber-400">Order Note:</span> {cleanNote}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {o.status === "PENDING" ? (
                    <button
                      onClick={() => act(o.id, "start")}
                      disabled={busyId === o.id}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(245,158,11,0.35)] active:scale-[0.98] disabled:opacity-50 border border-white/30"
                    >
                      START PREPARING
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => act(o.id, "ready", false)}
                        disabled={busyId === o.id}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm tracking-wide transition-all shadow-[0_4px_20px_rgba(16,185,129,0.35)] active:scale-[0.98] disabled:opacity-50 border border-white/30 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={18} />
                        <span>{autoPrintOnReady ? "MARK READY & PRINT SLIP" : "MARK READY"}</span>
                        {autoPrintOnReady && <Printer size={16} className="text-emerald-200 ml-1" />}
                      </button>

                      {/* If auto-print is OFF, give a secondary direct Ready & Print button */}
                      {!autoPrintOnReady && (
                        <button
                          onClick={() => act(o.id, "ready", true)}
                          disabled={busyId === o.id}
                          className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <Printer size={14} className="text-emerald-400" />
                          <span>Mark Ready & Print KOT Slip</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KOT SLIP PRINT PREVIEW MODAL (Screen display) */}
      {previewOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:hidden">
          <div className="bg-slate-900 border border-white/20 rounded-3xl w-full max-w-md p-6 shadow-2xl relative animate-scale-in">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Printer size={20} className="text-emerald-400" />
                <h3 className="font-bold text-white text-lg">Kitchen Order Slip (KOT)</h3>
              </div>
              <button
                onClick={() => setPreviewOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Simulated Receipt Preview */}
            <div className="bg-white text-black p-5 rounded-xl font-mono text-xs leading-relaxed shadow-inner border border-slate-300 space-y-2.5 max-h-[60vh] overflow-y-auto">
              <div className="text-center border-b border-dashed border-gray-400 pb-2">
                <p className="font-bold text-base tracking-wider uppercase">
                  {previewOrder.restaurant?.name || "RESTAURANT KITCHEN"}
                </p>
                <p className="font-bold text-xs text-gray-700">*** KITCHEN ORDER TICKET (KOT) ***</p>
                <p className="text-[10px] text-gray-500">Order Completed / Dispatch Slip</p>
              </div>

              <div className="border-b border-dashed border-gray-400 pb-2 space-y-1">
                <div className="flex justify-between items-center text-sm font-black">
                  <span className="text-base font-black">TABLE: {previewOrder.table.number}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-200 text-xs">
                    {previewOrder.customerNote?.includes("PARCEL") ? "📦 PARCEL" : "🍽️ DINE-IN"}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-700">
                  <span>Order No: #{previewOrder.orderNumber}</span>
                  <span>Waiter: {previewOrder.waiter.name}</span>
                </div>
                <div className="text-[10px] text-gray-500">
                  Time: {formatTicketDate(previewOrder.createdAt)}
                </div>
              </div>

              <div>
                <p className="font-bold text-[11px] uppercase mb-1.5">ORDERED MENU ITEMS:</p>
                <div className="space-y-1.5">
                  {previewOrder.items.map((item) => (
                    <div key={item.id} className="border-b border-dotted border-gray-200 pb-1">
                      <div className="flex justify-between font-bold text-xs">
                        <span>[ ] {item.quantity} × {item.nameSnapshot}</span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-red-600 pl-4 font-medium italic">
                          ↳ Note: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {previewOrder.customerNote && (
                <div className="bg-gray-100 p-2 rounded border border-gray-300 text-[11px]">
                  <span className="font-bold">Instructions: </span>
                  {previewOrder.customerNote}
                </div>
              )}

              <div className="border-t border-dashed border-gray-400 pt-2 text-center text-[10px] text-gray-600">
                <p className="font-bold text-black text-xs">*** READY FOR PICKUP & SERVE ***</p>
                <p>Printed: {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => {
                  triggerPrint(previewOrder);
                  setPreviewOrder(null);
                }}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                <Printer size={16} />
                <span>Print Ticket Now</span>
              </button>
              <button
                onClick={() => setPreviewOrder(null)}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED THERMAL / RECEIPT PRINTER KOT SLIP (Hidden on screen, rendered on window.print()) */}
      {printOrder && (
        <div id="kitchen-print-ticket" className="hidden print:block font-mono text-black bg-white leading-snug">
          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: "2px dashed #000", paddingBottom: "6px", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "900", margin: "0 0 2px 0", textTransform: "uppercase" }}>
              {printOrder.restaurant?.name || "RESTAURANT KITCHEN"}
            </h2>
            <p style={{ fontSize: "13px", fontWeight: "bold", margin: "0 0 2px 0" }}>
              *** KITCHEN ORDER TICKET (KOT) ***
            </p>
            <p style={{ fontSize: "11px", margin: "0" }}>
              {printOrder.customerNote?.includes("PARCEL") ? "[ 📦 TAKEAWAY / PARCEL ORDER ]" : "[ 🍽️ DINE-IN SERVICE ]"}
            </p>
          </div>

          {/* Table & Order Details */}
          <div style={{ borderBottom: "1px dashed #000", paddingBottom: "6px", marginBottom: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "20px", fontWeight: "900", letterSpacing: "1px" }}>
                TABLE: {printOrder.table.number}
              </span>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                #{printOrder.orderNumber}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "3px" }}>
              <span>Waiter: <b>{printOrder.waiter.name}</b></span>
              <span>Time: {formatTicketDate(printOrder.createdAt)}</span>
            </div>
          </div>

          {/* Ordered Menu Items */}
          <div style={{ marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "12px", borderBottom: "1px solid #000", paddingBottom: "3px", marginBottom: "4px" }}>
              <span>QTY &nbsp; MENU ITEM</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {printOrder.items.map((item) => (
                <div key={item.id} style={{ fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", fontWeight: "bold" }}>
                    <span style={{ marginRight: "6px" }}>[ ]</span>
                    <span style={{ width: "26px" }}>{item.quantity}×</span>
                    <span style={{ flex: 1 }}>{item.nameSnapshot}</span>
                  </div>
                  {item.notes && (
                    <div style={{ fontSize: "11px", fontWeight: "normal", paddingLeft: "38px", color: "#333", marginTop: "2px" }}>
                      * Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Special Instructions & Parcel Alert */}
          {(printOrder.customerNote || printOrder.customerNote?.includes("PARCEL")) && (
            <div style={{ border: "1px solid #000", padding: "5px", fontSize: "11px", marginBottom: "8px" }}>
              {printOrder.customerNote?.includes("PARCEL") && (
                <div style={{ fontWeight: "900", marginBottom: "2px" }}>
                  *** PACK FOR PARCEL / TAKEAWAY ***
                </div>
              )}
              {printOrder.customerNote && (
                <div>Note: {printOrder.customerNote.replace(/\[(📦 PARCEL \/ TAKEAWAY|🍽️ DINE IN)\]\s*/g, "").trim()}</div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: "2px dashed #000", paddingTop: "6px", textAlign: "center", fontSize: "11px" }}>
            <p style={{ fontWeight: "900", fontSize: "13px", margin: "0 0 2px 0" }}>
              *** ORDER READY / COMPLETED ***
            </p>
            <p style={{ margin: "0", fontSize: "10px" }}>
              Total Items: {printOrder.items.reduce((acc, i) => acc + i.quantity, 0)} &nbsp;|&nbsp; Printed: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

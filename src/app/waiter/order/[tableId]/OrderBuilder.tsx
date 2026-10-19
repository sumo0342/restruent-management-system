"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Send } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  available: boolean;
  isVeg: boolean;
};
type Category = { id: string; name: string; items: MenuItem[] };

type CartLine = { menuItemId: string; name: string; price: number; quantity: number; notes: string };

export function OrderBuilder({ tableId, categories }: { tableId: string; categories: Category[] }) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [orderType, setOrderType] = useState<"DINE_IN" | "PARCEL">("DINE_IN");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = Object.values(cart);
  const total = useMemo(() => lines.reduce((s, l) => s + l.price * l.quantity, 0), [lines]);

  function addItem(item: MenuItem) {
    setCart((c) => {
      const existing = c[item.id];
      return {
        ...c,
        [item.id]: existing
          ? { ...existing, quantity: existing.quantity + 1 }
          : { menuItemId: item.id, name: item.name, price: item.price, quantity: 1, notes: "" },
      };
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((c) => {
      const line = c[id];
      if (!line) return c;
      const qty = line.quantity + delta;
      if (qty <= 0) {
        const { [id]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [id]: { ...line, quantity: qty } };
    });
  }

  function setNote(id: string, notes: string) {
    setCart((c) => (c[id] ? { ...c, [id]: { ...c[id], notes } } : c));
  }

  async function submit() {
    if (lines.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const typePrefix = orderType === "PARCEL" ? "[📦 PARCEL / TAKEAWAY]" : "[🍽️ DINE IN]";
      const combinedNote = customerNote.trim()
        ? `${typePrefix} ${customerNote.trim()}`
        : typePrefix;

      const res = await fetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          customerNote: combinedNote,
          items: lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes || undefined })),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.push("/waiter/tables");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Could not send the order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-28">
      {/* Dine In vs Parcel Service Selector */}
      <div className="card p-3.5 bg-white/[0.04] border-white/10 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
            orderType === "PARCEL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          }`}>
            {orderType === "PARCEL" ? "📦" : "🍽️"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Service Mode</span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                orderType === "PARCEL" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              }`}>
                {orderType === "PARCEL" ? "PARCEL / PACK" : "DINE IN"}
              </span>
            </div>
            <p className="text-[11px] text-[#9DB7AA]">
              {orderType === "PARCEL" ? "Food packed for takeaway in containers" : "Table service with plates and cutlery"}
            </p>
          </div>
        </div>

        <div className="flex bg-[#061812] p-1 rounded-xl border border-white/10 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setOrderType("DINE_IN")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              orderType === "DINE_IN"
                ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>🍽️ Dine In</span>
          </button>
          <button
            type="button"
            onClick={() => setOrderType("PARCEL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              orderType === "PARCEL"
                ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>📦 Parcel (Takeaway)</span>
          </button>
        </div>
      </div>
      {categories.map((cat) => (
        <div key={cat.id}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-xs uppercase tracking-widest text-[#9DB7AA] font-bold">{cat.name}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {cat.items.map((item) => {
              const inCart = cart[item.id];
              return (
                <button
                  key={item.id}
                  disabled={!item.available}
                  onClick={() => addItem(item)}
                  className={`card p-3.5 text-left relative transition-all duration-200 ${
                    !item.available
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:border-emerald-400 hover:shadow-[0_4px_16px_rgba(16,185,129,0.2)]"
                  } ${inCart ? "border-emerald-400 bg-emerald-950/40 shadow-[0_0_16px_rgba(16,185,129,0.35)] ring-1 ring-emerald-400/50" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        item.isVeg
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-400" : "bg-amber-400"}`} />
                      {item.isVeg ? "VEG" : "NON-VEG"}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-[#FAF8F5]">{item.name}</p>
                  <p className="text-xs text-emerald-300 font-bold mt-1">₹{item.price.toFixed(2)}</p>
                  {!item.available && <span className="text-[10px] text-rose-400 font-bold block mt-1">OUT OF STOCK</span>}
                  {inCart && (
                    <span className="absolute -top-2.5 -right-2 bg-[#FAF8F5] text-[#061812] text-xs font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-emerald-400 shadow-md">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {lines.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 left-0 right-0 md:left-64 px-4 z-30">
          <div className="glass-panel p-5 max-w-2xl mx-auto shadow-2xl border-emerald-500/30 bg-[#0B261E]/95 backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm font-extrabold text-[#FAF8F5] tracking-wide">Current Order Round ({lines.length} items)</p>
              </div>
              <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setOrderType("DINE_IN")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    orderType === "DINE_IN" ? "bg-emerald-500 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🍽️ Dine In
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType("PARCEL")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    orderType === "PARCEL" ? "bg-amber-500 text-slate-950 font-extrabold" : "text-slate-400 hover:text-white"
                  }`}
                >
                  📦 Parcel
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {lines.map((l) => (
                <div key={l.menuItemId} className="flex items-center gap-2 text-sm bg-white/[0.03] p-2 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(l.menuItemId, -1)} className="btn-secondary !p-1 !h-7 !w-7 rounded-lg"><Minus size={12} /></button>
                    <span className="w-5 text-center font-bold text-white">{l.quantity}</span>
                    <button onClick={() => changeQty(l.menuItemId, 1)} className="btn-secondary !p-1 !h-7 !w-7 rounded-lg"><Plus size={12} /></button>
                  </div>
                  <span className="flex-1 truncate font-medium text-[#FAF8F5]">{l.name}</span>
                  <input
                    placeholder="special note"
                    value={l.notes}
                    onChange={(e) => setNote(l.menuItemId, e.target.value)}
                    className="input !py-1 !text-xs w-28 !rounded-lg"
                  />
                  <span className="text-emerald-300 font-bold w-16 text-right shrink-0">₹{(l.price * l.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <input
              placeholder={orderType === "PARCEL" ? "📦 Packaging note (e.g. pack gravy separately, extra chutney, pack cutlery)" : "🍽️ Table note (e.g. less oil, extra chutney, serve together)"}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              className="input mt-3"
            />
            {error && <p className="text-xs text-rose-400 font-semibold mt-2">{error}</p>}

            <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/10">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#9DB7AA]">Round Total</p>
                <span className="font-extrabold text-xl text-[#FAF8F5]">₹{total.toFixed(2)}</span>
              </div>
              <button onClick={submit} disabled={submitting} className="btn-primary !px-5 !py-2.5 !text-sm font-bold shadow-lg">
                <Send size={15} /> {submitting ? "Sending to kitchen..." : "Send to kitchen line"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

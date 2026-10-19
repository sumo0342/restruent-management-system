"use client";

import { useState } from "react";
import { Smartphone, Send, CheckCircle2, Copy, X, MessageSquare, AlertCircle } from "lucide-react";

type Props = {
  restaurantName: string;
  billNumber: number;
  tableNumber?: string;
  total: number;
  upiId?: string | null;
  isPaid: boolean;
  items: { quantity: number; nameSnapshot: string; total: number }[];
};

export function SendReceiptMobileButton({
  restaurantName,
  billNumber,
  tableNumber,
  total,
  upiId,
  isPaid,
  items,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cleanNumber(input: string) {
    return input.replace(/\D/g, "").slice(-10);
  }

  function formatBillMessage(targetPhone?: string) {
    const lines = items.map((i) => `• ${i.quantity}× ${i.nameSnapshot} = ₹${i.total.toFixed(2)}`).join("\n");
    return `🧾 *${restaurantName}*
*Tax Invoice / Bill #${billNumber}*
Table: ${tableNumber || "-"} · Status: ${isPaid ? "PAID ✅" : "UNPAID ⏳"}

*Items Ordered:*
${lines}

-----------------------------
*TOTAL AMOUNT: ₹${total.toFixed(2)}*
-----------------------------
${!isPaid && upiId ? `💳 *Pay via UPI:* ${upiId}\n` : ""}
Thank you for dining with us! 🙏`;
  }

  function handleSendWhatsApp() {
    const raw = cleanNumber(phone);
    if (raw.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }
    setError(null);
    const msg = formatBillMessage(raw);
    const url = `https://api.whatsapp.com/send?phone=91${raw}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
    showNotification(`Bill #${billNumber} sent to +91 ${raw} on WhatsApp!`);
  }

  function handleSendSms() {
    const raw = cleanNumber(phone);
    if (raw.length !== 10) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }
    setError(null);
    const msg = formatBillMessage(raw);
    window.location.href = `sms:+91${raw}?body=${encodeURIComponent(msg)}`;
    navigator.clipboard?.writeText(msg);
    showNotification(`Bill #${billNumber} SMS prepared for +91 ${raw}!`);
  }

  function handleCopy() {
    const msg = formatBillMessage();
    navigator.clipboard?.writeText(msg);
    showNotification(`Receipt summary copied to clipboard!`);
  }

  function showNotification(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary text-xs flex items-center justify-center gap-1.5 flex-1 border-teal-500/40 text-teal-800 bg-teal-50 hover:bg-teal-100 font-semibold py-2 px-3 shadow-xs"
        title="Send bill directly to diner's mobile number"
      >
        <Smartphone size={14} className="text-teal-600" />
        <span>Send to Mobile</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-line animate-page">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={18} />
                <h3 className="font-bold text-sm">Send Bill to Mobile</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="text-white/80 hover:text-white p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-panel/40 p-3 rounded-lg border border-line text-xs font-mono space-y-1">
                <div className="flex justify-between font-bold text-ink">
                  <span>Bill #{billNumber}</span>
                  <span className="text-emerald-600">₹{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-smoke text-[11px]">
                  <span>Table: {tableNumber || "-"}</span>
                  <span>{isPaid ? "Status: PAID" : "Status: BILLED"}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-ink flex items-center gap-1">
                  <span>Diner Mobile Number</span>
                  <span className="text-smoke font-normal">(WhatsApp / SMS)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="px-2.5 py-2 rounded-lg bg-panel border border-line text-xs font-mono font-bold text-ink">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="Enter 10-digit number"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                      setError(null);
                    }}
                    className="input flex-1 py-2 text-sm font-mono tracking-wider"
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertCircle size={12} /> {error}
                  </p>
                )}
              </div>

              {toast && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium animate-toast">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>{toast}</span>
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <MessageSquare size={14} />
                  <span>💬 Send via WhatsApp</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSendSms}
                    className="py-2 px-2.5 rounded-xl border border-line hover:bg-panel text-ink font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Send size={13} className="text-teal-600" />
                    <span>Send SMS</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="py-2 px-2.5 rounded-xl border border-line hover:bg-panel text-ink font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Copy size={13} className="text-smoke" />
                    <span>Copy Text</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

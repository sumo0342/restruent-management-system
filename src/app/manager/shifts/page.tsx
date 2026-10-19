"use client";

import { useEffect, useState } from "react";

type Shift = { id: string; openingCash: number; openedAt: string; status: string } | null;

export default function ShiftsPage() {
  const [shift, setShift] = useState<Shift>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("0");
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/manager/shift", { cache: "no-store" });
    const json = await res.json();
    if (json.ok) setShift(json.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openShift() {
    setError(null);
    const res = await fetch("/api/manager/shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingCash: Number(openingCash) || 0 }),
    });
    const json = await res.json();
    if (!json.ok) return setError(json.error);
    load();
  }

  async function closeShift() {
    if (!shift) return;
    setError(null);
    const res = await fetch(`/api/manager/shift/${shift.id}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingCashActual: Number(closingCash) || 0 }),
    });
    const json = await res.json();
    if (!json.ok) return setError(json.error);
    setSummary(json.data.summary);
    setShift(null);
  }

  if (loading) return null;

  return (
    <div className="p-4 md:p-8 max-w-md space-y-6">
      <div>
        <h1 className="font-display text-2xl">Shift</h1>
        <p className="text-smoke text-sm">Open a shift before taking payments, close it to reconcile cash.</p>
      </div>

      {!shift && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold">Open shift</p>
          <input value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} type="number" placeholder="Opening cash" className="input" />
          <button onClick={openShift} className="btn-primary w-full">Open shift</button>
        </div>
      )}

      {shift && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-semibold">Shift open since {new Date(shift.openedAt).toLocaleTimeString("en-IN")}</p>
          <p className="text-sm text-smoke">Opening cash: ₹{shift.openingCash.toFixed(2)}</p>
          <input value={closingCash} onChange={(e) => setClosingCash(e.target.value)} type="number" placeholder="Actual cash counted" className="input" />
          <button onClick={closeShift} className="btn-primary w-full">Close shift</button>
        </div>
      )}

      {summary && (
        <div className="card p-5 space-y-1 text-sm">
          <p className="font-semibold mb-2">Closing summary</p>
          <div className="flex justify-between"><span>Cash sales</span><span>₹{summary.cashSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>UPI sales</span><span>₹{summary.upiSales.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Card sales</span><span>₹{summary.cardSales.toFixed(2)}</span></div>
          <div className="flex justify-between font-semibold border-t border-line pt-1"><span>Expected cash</span><span>₹{summary.expectedCash.toFixed(2)}</span></div>
          <div className={`flex justify-between font-semibold ${summary.difference !== 0 ? "text-flame" : "text-verdigris"}`}>
            <span>Difference</span><span>₹{summary.difference.toFixed(2)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-flame">{error}</p>}
    </div>
  );
}

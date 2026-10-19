"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function serve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/waiter/orders/${orderId}/serve`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestCancel() {
    const reason = prompt("Reason for cancellation?");
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/waiter/orders/${orderId}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {status === "READY" && (
          <button onClick={serve} disabled={busy} className="btn-primary flex-1">
            Mark served → send to billing
          </button>
        )}
        {(status === "PENDING" || status === "PREPARING") && (
          <button onClick={requestCancel} disabled={busy} className="btn-danger flex-1">
            Request cancel
          </button>
        )}
        {status === "SERVED" && <span className="text-xs text-smoke">Waiting for manager to bill this round.</span>}
        {status === "CANCEL_REQUESTED" && <span className="text-xs text-flame">Cancellation requested — awaiting manager approval.</span>}
      </div>
      {error && <p className="text-xs text-flame mt-2">{error}</p>}
    </div>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { branchScope } from "@/lib/branchScope";
import { Receipt, Banknote, CreditCard, QrCode, Sparkles, Building2, Wallet, ArrowUpRight } from "lucide-react";

function getMethodBadge(method: string) {
  switch (method) {
    case "CASH":
      return { label: "Cash", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: Banknote };
    case "CARD":
      return { label: "Card", color: "bg-blue-100 text-blue-800 border-blue-300", icon: CreditCard };
    case "UPI":
      return { label: "UPI", color: "bg-purple-100 text-purple-800 border-purple-300", icon: QrCode };
    case "GATEWAY":
      return { label: "Razorpay", color: "bg-indigo-100 text-indigo-800 border-indigo-300", icon: Sparkles };
    case "NET_BANKING":
      return { label: "NetBanking", color: "bg-teal-100 text-teal-800 border-teal-300", icon: Building2 };
    case "WALLET":
      return { label: "Wallet", color: "bg-amber-100 text-amber-800 border-amber-300", icon: Wallet };
    default:
      return { label: method, color: "bg-gray-100 text-gray-800 border-gray-300", icon: Receipt };
  }
}

export default async function PaymentsPage() {
  const user = await getCurrentUser();

  const bills = await prisma.bill.findMany({
    where: {
      restaurantId: user!.restaurantId,
      status: { in: ["PAID", "CLOSED"] },
      ...branchScope(user!),
    },
    include: {
      session: { include: { table: true } },
      issuedBy: { select: { name: true } },
      payments: true,
    },
    orderBy: { paidAt: "desc" },
    take: 100,
  });

  const totalCollected = bills.reduce((sum, b) => sum + b.total, 0);
  const allPayments = bills.flatMap((b) => b.payments);
  const cashTotal = allPayments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0);
  const digitalTotal = totalCollected - cashTotal;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Payments & Settlement Ledger</h1>
          <p className="text-smoke text-sm">
            Audited history of completed orders, multi-tender transactions, and thermal receipts.
          </p>
        </div>
        <Link href="/manager/billing" className="btn-primary text-xs py-2 px-3 shadow-sm self-start sm:self-auto">
          Take New Payment
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 bg-white border border-line shadow-sm space-y-1">
          <span className="text-xs uppercase tracking-wider text-smoke font-semibold">Total Revenue (Last 100 Bills)</span>
          <p className="font-display text-2xl font-bold text-ink">{formatMoney(totalCollected)}</p>
          <span className="text-[11px] text-smoke font-mono">{bills.length} bills settled</span>
        </div>

        <div className="card p-4 bg-white border border-line shadow-sm space-y-1">
          <span className="text-xs uppercase tracking-wider text-emerald-800 font-semibold flex items-center gap-1">
            <Banknote size={14} /> Cash Settlements
          </span>
          <p className="font-display text-2xl font-bold text-emerald-900">{formatMoney(cashTotal)}</p>
          <span className="text-[11px] text-smoke font-mono">
            {totalCollected > 0 ? ((cashTotal / totalCollected) * 100).toFixed(0) : 0}% of settled sales
          </span>
        </div>

        <div className="card p-4 bg-white border border-line shadow-sm space-y-1">
          <span className="text-xs uppercase tracking-wider text-purple-800 font-semibold flex items-center gap-1">
            <QrCode size={14} /> Digital, UPI & Card Settlements
          </span>
          <p className="font-display text-2xl font-bold text-purple-900">{formatMoney(digitalTotal)}</p>
          <span className="text-[11px] text-smoke font-mono">
            {totalCollected > 0 ? ((digitalTotal / totalCollected) * 100).toFixed(0) : 0}% of settled sales
          </span>
        </div>
      </div>

      {/* Transactions Table / List */}
      <div className="card divide-y divide-line animate-stagger shadow-sm overflow-hidden">
        {bills.map((b) => (
          <Link
            key={b.id}
            href={`/manager/receipt/${b.id}`}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-panel/50 transition-colors group"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink flex items-center gap-1.5 font-display text-base">
                  <Receipt size={15} className="text-flame shrink-0" />
                  Bill #{b.billNumber} · Table {b.session.table.number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium">
                  PAID
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-smoke">
                <span>{b.paidAt ? formatDateTime(b.paidAt) : "—"}</span>
                <span>•</span>
                <span>Billed by {b.issuedBy.name}</span>
                <span>•</span>
                <div className="flex flex-wrap gap-1">
                  {b.payments.map((p) => {
                    const badge = getMethodBadge(p.method);
                    const Icon = badge.icon;
                    return (
                      <span
                        key={p.id}
                        className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${badge.color}`}
                      >
                        <Icon size={11} />
                        <span>{badge.label} ({formatMoney(p.amount)})</span>
                        {p.transactionReference && (
                          <span className="opacity-75 font-mono truncate max-w-[120px]">
                            [{p.transactionReference}]
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
              <span className="font-display text-xl font-bold text-ink">{formatMoney(b.total)}</span>
              <span className="p-1 rounded bg-panel text-smoke group-hover:text-ink group-hover:bg-line transition-colors">
                <ArrowUpRight size={16} />
              </span>
            </div>
          </Link>
        ))}

        {bills.length === 0 && (
          <div className="p-12 text-center text-smoke text-sm space-y-2">
            <Receipt size={32} className="mx-auto text-smoke/50" />
            <p className="font-medium">No paid bills yet.</p>
            <p className="text-xs">Once payments are recorded on the Billing board, they will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { Receipt } from "lucide-react";

function rangeStart(days: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const restaurantId = user!.restaurantId;

  const [daily, weekly, monthly, yearly, taxTotals, discountTotals, cancelled, shifts, recentBills, pendingBills] = await Promise.all([
    billsSince(restaurantId, rangeStart(1)),
    billsSince(restaurantId, rangeStart(7)),
    billsSince(restaurantId, rangeStart(30)),
    billsSince(restaurantId, rangeStart(365)),
    prisma.bill.aggregate({ where: { restaurantId, status: { in: ["PAID", "CLOSED"] } }, _sum: { taxAmount: true } }),
    prisma.bill.aggregate({ where: { restaurantId, status: { in: ["PAID", "CLOSED"] } }, _sum: { discountAmount: true } }),
    prisma.order.count({ where: { restaurantId, status: "CANCELLED" } }),
    prisma.shift.findMany({ where: { restaurantId, status: "CLOSED" }, orderBy: { closedAt: "desc" }, take: 10, include: { cashier: { select: { name: true } } } }),
    prisma.bill.findMany({
      where: { restaurantId, status: { in: ["PAID", "CLOSED"] } },
      include: { session: { include: { table: true } } },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
    prisma.bill.findMany({
      where: { restaurantId, status: "BILLED" },
      include: { session: { include: { table: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows = [
    { label: "Daily sales (24h)", ...daily },
    { label: "Weekly sales (7d)", ...weekly },
    { label: "Monthly sales (30d)", ...monthly },
    { label: "Yearly sales (365d)", ...yearly },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl">Reports</h1>
          <p className="text-smoke text-sm">Sales, tax, discounts and shift history.</p>
        </div>
        <a href="/api/owner/export/bills" className="btn-secondary">Export bills (CSV)</a>
      </div>

      <div className="card divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="p-4 flex justify-between">
            <span>{r.label}</span>
            <span className="font-semibold">{formatMoney(r.total)} <span className="text-smoke font-normal text-xs">({r.count} bills)</span></span>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-smoke uppercase">Total tax collected</p>
          <p className="font-display text-xl mt-1">{formatMoney(taxTotals._sum.taxAmount ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-smoke uppercase">Total discounts given</p>
          <p className="font-display text-xl mt-1">{formatMoney(discountTotals._sum.discountAmount ?? 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-smoke uppercase">Cancelled orders</p>
          <p className="font-display text-xl mt-1">{cancelled}</p>
        </div>
      </div>

      {pendingBills.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Unpaid bills ({pendingBills.length})</p>
          <div className="card divide-y divide-line text-sm animate-stagger">
            {pendingBills.map((b) => (
              <Link key={b.id} href={`/manager/receipt/${b.id}`} className="p-3 flex justify-between hover:bg-panel/60 transition-colors">
                <span>Bill #{b.billNumber} · Table {b.session.table.number}</span>
                <span className="font-semibold">{formatMoney(b.total)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold mb-2">Recent paid bills</p>
        <div className="card divide-y divide-line text-sm animate-stagger">
          {recentBills.map((b) => (
            <Link key={b.id} href={`/manager/receipt/${b.id}`} className="p-3 flex items-center justify-between gap-3 hover:bg-panel/60 transition-colors">
              <span className="flex items-center gap-2 min-w-0">
                <Receipt size={13} className="text-smoke shrink-0" />
                <span className="truncate">Bill #{b.billNumber} · Table {b.session.table.number} · {b.paidAt ? formatDateTime(b.paidAt) : "—"}</span>
              </span>
              <span className="font-semibold shrink-0">{formatMoney(b.total)}</span>
            </Link>
          ))}
          {recentBills.length === 0 && <p className="p-4 text-center text-smoke">No paid bills yet.</p>}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold mb-2">Recent shift reports</p>
        <div className="card divide-y divide-line text-sm">
          {shifts.map((s) => (
            <div key={s.id} className="p-3 flex justify-between">
              <span>{s.cashier.name} · opened {s.openedAt.toLocaleDateString("en-IN")}</span>
              <span>Opening {formatMoney(s.openingCash)} → Closing {formatMoney(s.closingCashActual ?? 0)}</span>
            </div>
          ))}
          {shifts.length === 0 && <p className="p-4 text-center text-smoke">No closed shifts yet.</p>}
        </div>
      </div>
    </div>
  );
}

async function billsSince(restaurantId: string, since: Date) {
  const bills = await prisma.bill.findMany({
    where: { restaurantId, status: { in: ["PAID", "CLOSED"] }, paidAt: { gte: since } },
    select: { total: true },
  });
  return { total: bills.reduce((s, b) => s + b.total, 0), count: bills.length };
}

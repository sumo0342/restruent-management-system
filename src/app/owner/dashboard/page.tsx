import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import { DashboardCharts } from "./DashboardCharts";
import { reconcileTableStatuses } from "@/lib/tableStatus";
import { IndianRupee, ClipboardList, CheckCircle2, Clock, LayoutGrid, XCircle } from "lucide-react";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function OwnerDashboardPage() {
  const user = await getCurrentUser();
  const restaurantId = user!.restaurantId;
  const today = startOfToday();
  await reconcileTableStatuses(restaurantId);

  const [
    todaysBills,
    todaysOrders,
    pendingBills,
    activeTables,
    cancelledToday,
    last7DaysBills,
    topItems,
    waiterCounts,
    paymentMix,
  ] = await Promise.all([
    prisma.bill.findMany({ where: { restaurantId, status: { in: ["PAID", "CLOSED"] }, paidAt: { gte: today } } }),
    prisma.order.count({ where: { restaurantId, createdAt: { gte: today } } }),
    prisma.bill.count({ where: { restaurantId, status: "BILLED" } }),
    prisma.restaurantTable.count({ where: { restaurantId, active: true, status: { not: "AVAILABLE" } } }),
    prisma.order.count({ where: { restaurantId, status: "CANCELLED", cancelledAt: { gte: today } } }),
    prisma.bill.findMany({
      where: { restaurantId, status: { in: ["PAID", "CLOSED"] }, paidAt: { gte: new Date(Date.now() - 6 * 86400000) } },
      select: { paidAt: true, total: true },
    }),
    prisma.orderItem.groupBy({
      by: ["nameSnapshot"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
      where: { order: { restaurantId, status: { in: ["PAID", "CLOSED", "BILLED"] } } },
    }),
    prisma.order.groupBy({
      by: ["waiterId"],
      _count: { _all: true },
      where: { restaurantId, createdAt: { gte: today } },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      where: { receivedBy: { restaurantId }, paidAt: { gte: today } },
    }),
  ]);

  const todaysSales = todaysBills.reduce((s, b) => s + b.total, 0);

  const salesByDay: Record<string, number> = {};
  for (const b of last7DaysBills) {
    const key = new Date(b.paidAt!).toLocaleDateString("en-IN", { weekday: "short" });
    salesByDay[key] = (salesByDay[key] ?? 0) + b.total;
  }

  const waiters = await prisma.user.findMany({ where: { id: { in: waiterCounts.map((w) => w.waiterId) } } });
  const waiterNameById = new Map(waiters.map((w) => [w.id, w.name]));

  const cards = [
    { label: "Today's sales", value: formatMoney(todaysSales), icon: IndianRupee, tint: "bg-verdigris/12 text-verdigris" },
    { label: "Today's orders", value: String(todaysOrders), icon: ClipboardList, tint: "bg-flame/12 text-flame" },
    { label: "Paid bills today", value: String(todaysBills.length), icon: CheckCircle2, tint: "bg-verdigris/12 text-verdigris" },
    { label: "Pending bills", value: String(pendingBills), icon: Clock, tint: "bg-brass/15 text-brass" },
    { label: "Active tables", value: String(activeTables), icon: LayoutGrid, tint: "bg-smoke/15 text-smoke" },
    { label: "Cancelled today", value: String(cancelledToday), icon: XCircle, tint: "bg-ink/8 text-ink/50" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display text-2xl">Dashboard</h1>
        <p className="text-smoke text-sm">Live snapshot of the restaurant today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 animate-stagger">
        {cards.map((c) => (
          <div key={c.label} className="card-lift p-4">
            <span className={`inline-flex w-9 h-9 rounded-lg items-center justify-center ${c.tint}`}>
              <c.icon size={17} strokeWidth={2.25} />
            </span>
            <p className="font-display text-2xl mt-3">{c.value}</p>
            <p className="text-xs text-smoke uppercase tracking-wide mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      <DashboardCharts
        salesByDay={Object.entries(salesByDay).map(([day, total]) => ({ day, total }))}
        topItems={topItems.map((t) => ({ name: t.nameSnapshot, qty: t._sum.quantity ?? 0 }))}
        waiterOrders={waiterCounts.map((w) => ({ name: waiterNameById.get(w.waiterId) ?? "—", count: w._count._all }))}
        paymentMix={paymentMix.map((p) => ({ method: p.method, amount: p._sum.amount ?? 0 }))}
      />
    </div>
  );
}

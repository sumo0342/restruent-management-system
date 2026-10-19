import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { formatMoney } from "@/lib/utils";
import { reconcileTableStatuses } from "@/lib/tableStatus";
import { branchScope } from "@/lib/branchScope";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function ManagerDashboardPage() {
  const user = await getCurrentUser();
  const today = startOfToday();
  await reconcileTableStatuses(user!.restaurantId);

  const [tables, todaysBills, waitingForBill] = await Promise.all([
    prisma.restaurantTable.findMany({ where: { restaurantId: user!.restaurantId, active: true, ...branchScope(user!) }, orderBy: { number: "asc" } }),
    prisma.bill.findMany({ where: { restaurantId: user!.restaurantId, status: { in: ["PAID", "CLOSED"] }, paidAt: { gte: today }, ...branchScope(user!) } }),
    prisma.restaurantTable.count({ where: { restaurantId: user!.restaurantId, status: "WAITING_FOR_BILL", ...branchScope(user!) } }),
  ]);

  const todaysSales = todaysBills.reduce((s, b) => s + b.total, 0);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl">Overview</h1>
        <p className="text-smoke text-sm">Live table status and today's basic numbers.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-smoke uppercase">Today's sales</p>
          <p className="font-display text-2xl mt-1">{formatMoney(todaysSales)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-smoke uppercase">Bills today</p>
          <p className="font-display text-2xl mt-1">{todaysBills.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-smoke uppercase">Waiting for bill</p>
          <p className="font-display text-2xl mt-1">{waitingForBill}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tables.map((t) => (
          <Link
            key={t.id}
            href={t.status === "WAITING_FOR_BILL" || t.status === "FOOD_READY" ? `/manager/billing?table=${t.id}` : "/manager/billing"}
            className="card p-4 hover:border-flame transition-colors"
          >
            <p className="font-display text-xl">Table {t.number}</p>
            <StatusPill status={t.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}

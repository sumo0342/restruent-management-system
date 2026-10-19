import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { formatDateTime, formatMoney } from "@/lib/utils";

export default async function OwnerOrdersPage() {
  const user = await getCurrentUser();
  const orders = await prisma.order.findMany({
    where: { restaurantId: user!.restaurantId },
    include: { table: true, waiter: { select: { name: true } }, items: true, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl space-y-4">
      <div>
        <h1 className="font-display text-2xl">All orders</h1>
        <p className="text-smoke text-sm">Most recent 100 orders across every table and status.</p>
      </div>

      <div className="card divide-y divide-line">
        {orders.map((o) => (
          <div key={o.id} className="p-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">Order #{o.orderNumber} · Table {o.table.number}{o.branch ? ` · ${o.branch.name}` : ""}</p>
              <p className="text-xs text-smoke">
                {o.waiter.name} · {formatDateTime(o.createdAt)} ·{" "}
                {o.items.length} item{o.items.length > 1 ? "s" : ""} ·{" "}
                {formatMoney(o.items.reduce((s, i) => s + i.total, 0))}
              </p>
            </div>
            <StatusPill status={o.status} />
          </div>
        ))}
        {orders.length === 0 && <p className="p-6 text-sm text-smoke text-center">No orders yet.</p>}
      </div>
    </div>
  );
}

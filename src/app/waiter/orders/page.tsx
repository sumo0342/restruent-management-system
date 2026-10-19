import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderActions } from "./OrderActions";
import { StatusPill } from "@/components/StatusPill";
import { formatTime, minutesSince } from "@/lib/utils";
import { branchScope } from "@/lib/branchScope";

export default async function WaiterOrdersPage() {
  const user = await getCurrentUser();
  const orders = await prisma.order.findMany({
    where: {
      restaurantId: user!.restaurantId,
      ...branchScope(user!),
      ...(user!.role === "WAITER" ? { waiterId: user!.id } : {}),
      status: { in: ["PENDING", "PREPARING", "READY", "SERVED", "CANCEL_REQUESTED"] },
    },
    include: { table: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-4">
      <div>
        <h1 className="font-display text-2xl">My active orders</h1>
        <p className="text-smoke text-sm">Serve ready food and send it to billing.</p>
      </div>

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="font-medium">Order #{o.orderNumber} · Table {o.table.number}</p>
              <StatusPill status={o.status} />
            </div>
            <p className="text-xs text-smoke mb-2">
              {formatTime(o.createdAt)} · {minutesSince(o.createdAt)} min ago
            </p>
            <ul className="text-sm space-y-0.5 mb-3">
              {o.items.map((i) => (
                <li key={i.id}>
                  {i.quantity}× {i.nameSnapshot} {i.notes ? <span className="text-smoke">— {i.notes}</span> : null}
                </li>
              ))}
            </ul>
            {o.customerNote && <p className="text-xs text-smoke italic mb-3">Note: {o.customerNote}</p>}
            <OrderActions orderId={o.id} status={o.status} />
          </div>
        ))}
        {orders.length === 0 && <p className="text-sm text-smoke text-center py-8">No active orders.</p>}
      </div>
    </div>
  );
}

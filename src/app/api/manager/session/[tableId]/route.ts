export const dynamic = "force-dynamic";

import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";

export async function GET(_req: Request, { params }: { params: { tableId: string } }) {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: params.tableId, restaurantId: user.restaurantId, ...branchScope(user) },
    });
    if (!table) throw new Error("Table not found.");

    // Query active open session using OR to match both null and unset closedAt in MongoDB
    const session = await prisma.tableSession.findFirst({
      where: {
        tableId: table.id,
        OR: [{ closedAt: null }, { closedAt: { isSet: false } }],
      },
      include: {
        orders: {
          include: { items: true, waiter: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
        bill: { include: { payments: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const restaurant = await prisma.restaurant.findUnique({ where: { id: user.restaurantId } });

    if (!session) {
      // Find latest closed bill for this table for reprinting/viewing
      const lastClosedSession = await prisma.tableSession.findFirst({
        where: { tableId: table.id, closedAt: { not: null } },
        include: {
          orders: {
            include: { items: true, waiter: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
          },
          bill: { include: { payments: true } },
        },
        orderBy: { closedAt: "desc" },
      });

      return {
        table,
        session: null,
        restaurant,
        lastBill: lastClosedSession?.bill ?? null,
      };
    }

    const billableOrders = session.orders.filter((o) =>
      ["BILL_PENDING", "BILLED", "PAID"].includes(o.status)
    );
    const subtotal = billableOrders
      .flatMap((o) => o.items)
      .reduce((sum, item) => sum + item.total, 0);

    return {
      table,
      session,
      restaurant,
      billableOrders,
      subtotal: Math.round(subtotal * 100) / 100,
    };
  });
}

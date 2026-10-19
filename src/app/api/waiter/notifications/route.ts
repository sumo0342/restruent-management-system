import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";

export async function GET() {
  return withRole(["WAITER", "OWNER"], async (user) => {
    const readyOrders = await prisma.order.findMany({
      where: {
        restaurantId: user.restaurantId,
        status: "READY",
        ...branchScope(user),
        ...(user.role === "WAITER" ? { waiterId: user.id } : {}),
      },
      include: { table: true },
      orderBy: { readyAt: "asc" },
    });
    return readyOrders.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      tableNumber: o.table.number,
      readyAt: o.readyAt,
    }));
  });
}

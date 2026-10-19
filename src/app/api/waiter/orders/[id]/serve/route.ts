import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertTransition } from "@/lib/orderStateMachine";
import { branchScope } from "@/lib/branchScope";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withRole(["WAITER", "OWNER"], async (user) => {
    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: user.restaurantId, ...branchScope(user) },
    });
    if (!order) throw new Error("Order not found.");

    assertTransition(order.status, "SERVED", user.role);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "SERVED", servedAt: new Date() },
      });
      const result = await tx.order.update({
        where: { id: order.id },
        data: { status: "BILL_PENDING" },
      });
      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: "WAITING_FOR_BILL" },
      });
      return result;
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "ORDER_SERVED",
      entityType: "Order",
      entityId: order.id,
      details: `Order #${order.orderNumber} served, sent to billing`,
    });

    return updated;
  });
}

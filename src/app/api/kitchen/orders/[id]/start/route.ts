import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertTransition } from "@/lib/orderStateMachine";
import { branchScope } from "@/lib/branchScope";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withRole(["KITCHEN", "OWNER"], async (user) => {
    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: user.restaurantId, ...branchScope(user) },
    });
    if (!order) throw new Error("Order not found.");

    assertTransition(order.status, "PREPARING", user.role);

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "PREPARING", preparingAt: new Date(), kitchenStaffId: user.id },
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "ORDER_PREPARING",
      entityType: "Order",
      entityId: order.id,
      details: `Order #${order.orderNumber} started`,
    });

    return updated;
  });
}

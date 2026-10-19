import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertTransition } from "@/lib/orderStateMachine";
import { branchScope } from "@/lib/branchScope";
import { z } from "zod";

const schema = z.object({ reason: z.string().min(1, "Give a reason.") });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withRole(["WAITER", "OWNER"], async (user) => {
    const { reason } = schema.parse(await req.json());
    const order = await prisma.order.findFirst({
      where: { id: params.id, restaurantId: user.restaurantId, ...branchScope(user) },
    });
    if (!order) throw new Error("Order not found.");

    assertTransition(order.status, "CANCEL_REQUESTED", user.role);

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCEL_REQUESTED" },
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "CANCEL_REQUESTED",
      entityType: "Order",
      entityId: order.id,
      details: `Order #${order.orderNumber}: ${reason}`,
    });

    return updated;
  });
}

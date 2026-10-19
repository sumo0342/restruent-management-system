import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { assertTransition } from "@/lib/orderStateMachine";
import { z } from "zod";

const schema = z.object({
  sessionId: z.string(),
  discountAmount: z.number().min(0).default(0),
  discountReason: z.string().optional(),
});

export async function POST(req: Request) {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const body = schema.parse(await req.json());

    const session = await prisma.tableSession.findUnique({
      where: { id: body.sessionId },
      include: { orders: { include: { items: true } }, bill: true, table: true },
    });
    // tableSession has no restaurantId of its own — it inherits scope from
    // its table, so both the tenant AND the branch check happen here. This
    // also closes a pre-existing gap where a sessionId from any restaurant
    // would otherwise have been accepted.
    if (
      !session ||
      session.table.restaurantId !== user.restaurantId ||
      (user.role !== "OWNER" && (session.table.branchId ?? null) !== (user.branchId ?? null))
    ) {
      throw new Error("Session not found.");
    }
    if (session.bill) throw new Error("This table already has a bill. Use payment instead.");

    const billableOrders = session.orders.filter((o) => o.status === "BILL_PENDING");
    if (billableOrders.length === 0) {
      throw new Error("No served orders are waiting to be billed for this table.");
    }
    for (const order of billableOrders) {
      assertTransition(order.status, "BILLED", user.role);
    }

    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: user.restaurantId },
    });

    const subtotal = billableOrders.flatMap((o) => o.items).reduce((s, i) => s + i.total, 0);
    const taxAmount = Math.round(((subtotal * restaurant.taxPercent) / 100) * 100) / 100;
    const serviceCharge =
      Math.round(((subtotal * restaurant.serviceChargePercent) / 100) * 100) / 100;
    const discountAmount = Math.min(body.discountAmount, subtotal + taxAmount + serviceCharge);
    const total =
      Math.round((subtotal + taxAmount + serviceCharge - discountAmount) * 100) / 100;

    if (body.discountAmount > 0 && user.role !== "MANAGER" && user.role !== "OWNER") {
      throw new Error("Only a manager or owner can apply a discount.");
    }

    const bill = await prisma.$transaction(
      async (tx) => {
        // Mongo has no autoincrement at all, so bill numbers are assigned
        // from a per-restaurant counter instead (see schema.prisma).
        const restaurantSeq = await tx.restaurant.update({
          where: { id: user.restaurantId },
          data: { billSeq: { increment: 1 } },
        });

        const created = await tx.bill.create({
          data: {
            billNumber: restaurantSeq.billSeq,
            restaurantId: user.restaurantId,
            branchId: session.table.branchId,
            sessionId: session.id,
            subtotal: Math.round(subtotal * 100) / 100,
            taxAmount,
            serviceCharge,
            discountAmount,
            discountReason: body.discountReason,
            total,
            status: "BILLED",
            issuedById: user.id,
          },
        });

        await tx.order.updateMany({
          where: { id: { in: billableOrders.map((o) => o.id) } },
          data: { status: "BILLED" },
        });

        await tx.restaurantTable.update({
          where: { id: session.table.id },
          data: { status: "WAITING_FOR_BILL" },
        });

        return created;
      },
      { maxWait: 20000, timeout: 35000 }
    );

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "BILL_GENERATED",
      entityType: "Bill",
      entityId: bill.id,
      details: `Bill #${bill.billNumber} total ${total}${
        discountAmount ? ` (discount ${discountAmount}: ${body.discountReason ?? "n/a"})` : ""
      }`,
    });

    return bill;
  });
}

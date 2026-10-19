import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { branchScope } from "@/lib/branchScope";
import { z } from "zod";

const schema = z.object({
  billId: z.string(),
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "CARD", "UPI", "NET_BANKING", "WALLET", "GATEWAY"]),
        amount: z.number().positive(),
        reference: z.string().optional(),
      })
    )
    .min(1),
});

export async function POST(req: Request) {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const body = schema.parse(await req.json());

    const bill = await prisma.bill.findFirst({
      where: { id: body.billId, restaurantId: user.restaurantId, ...branchScope(user) },
      include: { session: { include: { orders: true } } },
    });
    if (!bill) throw new Error("Bill not found.");
    if (bill.status === "PAID" || bill.status === "CLOSED") {
      throw new Error("This bill has already been paid. Duplicate payment blocked.");
    }

    const paidNow = body.payments.reduce((s, p) => s + p.amount, 0);
    const roundedPaidNow = Math.round(paidNow * 100) / 100;
    if (Math.abs(roundedPaidNow - bill.total) > 0.01) {
      throw new Error(
        `Payment total (₹${roundedPaidNow.toFixed(2)}) must match the bill total (₹${bill.total.toFixed(2)}).`
      );
    }

    const updatedBill = await prisma.$transaction(
      async (tx) => {
        for (const p of body.payments) {
          await tx.payment.create({
            data: {
              billId: bill.id,
              amount: p.amount,
              method: p.method,
              transactionReference: p.reference,
              receivedById: user.id,
            },
          });
        }

        const result = await tx.bill.update({
          where: { id: bill.id },
          data: { amountPaid: roundedPaidNow, status: "PAID", paidAt: new Date() },
        });

        const billedOrderIds = bill.session.orders
          .filter((o) => o.status === "BILLED")
          .map((o) => o.id);
        await tx.order.updateMany({
          where: { id: { in: billedOrderIds } },
          data: { status: "CLOSED" },
        });

        await tx.tableSession.update({
          where: { id: bill.sessionId },
          data: { closedAt: new Date() },
        });

        await tx.restaurantTable.update({
          where: { id: bill.session.tableId },
          data: { status: "AVAILABLE" },
        });

        return result;
      },
      { maxWait: 20000, timeout: 35000 }
    );

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "PAYMENT_RECORDED",
      entityType: "Bill",
      entityId: bill.id,
      details: `Bill #${bill.billNumber} paid (${body.payments.map((p) => `${p.method}:${p.amount}`).join(", ")})`,
    });

    return updatedBill;
  });
}

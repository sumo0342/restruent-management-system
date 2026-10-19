import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ closingCashActual: z.number().min(0) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const body = schema.parse(await req.json());
    const shift = await prisma.shift.findFirst({
      where: { id: params.id, cashierId: user.id, status: "OPEN" },
    });
    if (!shift) throw new Error("Open shift not found.");

    const payments = await prisma.payment.findMany({
      where: {
        receivedById: user.id,
        paidAt: { gte: shift.openedAt },
      },
    });

    const cashSales = sumBy(payments, "CASH");
    const upiSales = sumBy(payments, "UPI");
    const cardSales = sumBy(payments, "CARD");
    const expectedCash = shift.openingCash + cashSales;

    const updated = await prisma.shift.update({
      where: { id: shift.id },
      data: { status: "CLOSED", closedAt: new Date(), closingCashActual: body.closingCashActual },
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "SHIFT_CLOSED",
      entityType: "Shift",
      entityId: shift.id,
      details: `Expected cash ₹${expectedCash}, actual ₹${body.closingCashActual}`,
    });

    return {
      ...updated,
      summary: { cashSales, upiSales, cardSales, expectedCash, difference: body.closingCashActual - expectedCash },
    };
  });
}

function sumBy(payments: { method: string; amount: number }[], method: string) {
  return Math.round(payments.filter((p) => p.method === method).reduce((s, p) => s + p.amount, 0) * 100) / 100;
}

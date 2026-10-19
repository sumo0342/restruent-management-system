export const dynamic = "force-dynamic";

import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { branchScope } from "@/lib/branchScope";
import { z } from "zod";

const schema = z.object({
  tableId: z.string(),
  customerNote: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(50),
      })
    )
    .min(1, "Select at least one item."),
  discountAmount: z.number().min(0).optional(),
  discountReason: z.string().optional(),
});

export async function POST(req: Request) {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const body = schema.parse(await req.json());

    const table = await prisma.restaurantTable.findFirst({
      where: { id: body.tableId, restaurantId: user.restaurantId, active: true, ...branchScope(user) },
    });
    if (!table) throw new Error("Table not found.");

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: user.restaurantId },
    });
    if (!restaurant) throw new Error("Restaurant not found.");

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: body.items.map((i) => i.menuItemId) },
        restaurantId: user.restaurantId,
      },
    });
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    // Calculate subtotal
    let subtotal = 0;
    const orderItemsData: {
      menuItemId: string;
      nameSnapshot: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];
    for (const item of body.items) {
      const mi = menuById.get(item.menuItemId);
      if (!mi) throw new Error("Selected menu item not found.");
      const itemTotal = Math.round(mi.price * item.quantity * 100) / 100;
      subtotal += itemTotal;
      orderItemsData.push({
        menuItemId: mi.id,
        nameSnapshot: mi.name,
        quantity: item.quantity,
        unitPrice: mi.price,
        total: itemTotal,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const taxAmount = Math.round(((subtotal * restaurant.taxPercent) / 100) * 100) / 100;
    const serviceCharge = Math.round(((subtotal * restaurant.serviceChargePercent) / 100) * 100) / 100;
    const discountAmount = Math.min(body.discountAmount || 0, subtotal + taxAmount + serviceCharge);
    const total = Math.round((subtotal + taxAmount + serviceCharge - discountAmount) * 100) / 100;

    const result = await prisma.$transaction(async (tx) => {
      // Find or create open session
      let session = await tx.tableSession.findFirst({
        where: { tableId: table.id, closedAt: null },
      });
      if (!session) {
        session = await tx.tableSession.create({
          data: { tableId: table.id },
        });
      }

      // Increment counters
      const updatedRest = await tx.restaurant.update({
        where: { id: user.restaurantId },
        data: {
          orderSeq: { increment: 1 },
          billSeq: { increment: 1 },
        },
      });

      // Create order with BILLED status
      const order = await tx.order.create({
        data: {
          orderNumber: updatedRest.orderSeq,
          restaurantId: user.restaurantId,
          branchId: table.branchId,
          tableId: table.id,
          sessionId: session.id,
          waiterId: user.id,
          customerNote: body.customerNote,
          status: "BILLED",
          items: { create: orderItemsData },
          servedAt: new Date(),
        },
      });

      // Create Bill
      const bill = await tx.bill.create({
        data: {
          billNumber: updatedRest.billSeq,
          restaurantId: user.restaurantId,
          branchId: table.branchId,
          sessionId: session.id,
          subtotal,
          taxAmount,
          serviceCharge,
          discountAmount,
          discountReason: body.discountReason,
          total,
          status: "BILLED",
          issuedById: user.id,
        },
      });

      // Update table to WAITING_FOR_BILL
      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: "WAITING_FOR_BILL" },
      });

      return { bill, order, session };
    }, { maxWait: 20000, timeout: 35000 });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "QUICK_BILL_GENERATED",
      entityType: "Bill",
      entityId: result.bill.id,
      details: `Quick Bill #${result.bill.billNumber} created for Table ${table.number} (Total: ₹${result.bill.total})`,
    });

    return result.bill;
  });
}

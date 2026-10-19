import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { branchScope, menuScopeForTable } from "@/lib/branchScope";
import { z } from "zod";

const bodySchema = z.object({
  tableId: z.string(),
  customerNote: z.string().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(50),
        notes: z.string().optional(),
      })
    )
    .min(1, "Add at least one item."),
});

export async function POST(req: Request) {
  return withRole(["WAITER", "MANAGER", "OWNER"], async (user) => {
    const body = bodySchema.parse(await req.json());

    const table = await prisma.restaurantTable.findFirst({
      where: { id: body.tableId, restaurantId: user.restaurantId, active: true, ...branchScope(user) },
    });
    if (!table) throw new Error("Table not found.");

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: body.items.map((i) => i.menuItemId) },
        restaurantId: user.restaurantId,
        ...menuScopeForTable(table.branchId),
      },
    });
    const menuById = new Map(menuItems.map((m) => [m.id, m]));

    for (const item of body.items) {
      const menuItem = menuById.get(item.menuItemId);
      if (!menuItem) throw new Error("One of the selected items no longer exists.");
      if (!menuItem.available) throw new Error(`${menuItem.name} is out of stock.`);
    }

    const order = await prisma.$transaction(async (tx) => {
      let session = await tx.tableSession.findFirst({
        where: {
          tableId: table.id,
          OR: [{ closedAt: null }, { closedAt: { isSet: false } }],
        },
        orderBy: { openedAt: "desc" },
      });
      if (!session) {
        session = await tx.tableSession.create({ data: { tableId: table.id } });
      }

      // Mongo has no autoincrement at all, so order numbers are assigned
      // from a per-restaurant counter instead (see schema.prisma).
      const restaurant = await tx.restaurant.update({
        where: { id: user.restaurantId },
        data: { orderSeq: { increment: 1 } },
      });

      const created = await tx.order.create({
        data: {
          orderNumber: restaurant.orderSeq,
          restaurantId: user.restaurantId,
          branchId: table.branchId,
          tableId: table.id,
          sessionId: session.id,
          waiterId: user.id,
          customerNote: body.customerNote,
          status: "PENDING",
          items: {
            create: body.items.map((item) => {
              const menuItem = menuById.get(item.menuItemId)!;
              return {
                menuItemId: menuItem.id,
                nameSnapshot: menuItem.name,
                quantity: item.quantity,
                unitPrice: menuItem.price,
                total: Math.round(menuItem.price * item.quantity * 100) / 100,
                notes: item.notes,
              };
            }),
          },
        },
        include: { items: true, table: true },
      });

      await tx.restaurantTable.update({
        where: { id: table.id },
        data: { status: "ORDER_PENDING" },
      });

      return created;
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "SEND_TO_KITCHEN",
      entityType: "Order",
      entityId: order.id,
      details: `Order #${order.orderNumber} for table ${table.number}`,
    });

    return order;
  });
}

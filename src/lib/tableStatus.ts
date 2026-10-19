import { prisma } from "@/lib/prisma";

export const openSessionFilter = {
  OR: [{ closedAt: null }, { closedAt: { isSet: false } }],
};

/**
 * A table's `status` field is a denormalized cache, updated as a side effect
 * in several places (order created/served, kitchen ready, payment taken).
 *
 * This reconciles table statuses in BOTH directions:
 * 1. Tables with open sessions and served/pending orders get accurately
 *    marked WAITING_FOR_BILL, FOOD_READY, or OCCUPIED.
 * 2. Tables whose sessions have closed or are empty get returned to AVAILABLE.
 */
export async function reconcileTableStatuses(restaurantId: string): Promise<void> {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId, active: true },
    select: { id: true, status: true },
  });
  if (tables.length === 0) return;

  const tableIds = tables.map((t) => t.id);

  // In MongoDB Atlas, unset fields do not match `closedAt: null`.
  // We match both null and unset fields via { OR: [{ closedAt: null }, { closedAt: { isSet: false } }] }
  const openSessions = await prisma.tableSession.findMany({
    where: {
      tableId: { in: tableIds },
      OR: [{ closedAt: null }, { closedAt: { isSet: false } }],
    },
    include: {
      orders: { select: { status: true } },
      bill: { select: { status: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  const sessionByTable = new Map<string, (typeof openSessions)[0]>();
  for (const s of openSessions) {
    if (!sessionByTable.has(s.tableId)) {
      sessionByTable.set(s.tableId, s);
    }
  }

  const updates: { id: string; status: string }[] = [];

  for (const table of tables) {
    const session = sessionByTable.get(table.id);

    if (!session) {
      if (table.status !== "AVAILABLE" && table.status !== "CLEANING") {
        updates.push({ id: table.id, status: "AVAILABLE" });
      }
      continue;
    }

    const orders = session.orders;
    const hasBilledOrWaiting =
      session.bill?.status === "BILLED" ||
      orders.some((o) => o.status === "BILL_PENDING" || o.status === "BILLED");

    const hasFoodReady = orders.some((o) => o.status === "READY");
    const hasPreparingOrPending = orders.some(
      (o) => o.status === "PREPARING" || o.status === "PENDING"
    );

    let targetStatus = "AVAILABLE";
    if (hasBilledOrWaiting) {
      targetStatus = "WAITING_FOR_BILL";
    } else if (hasFoodReady) {
      targetStatus = "FOOD_READY";
    } else if (hasPreparingOrPending) {
      targetStatus = "OCCUPIED";
    } else if (orders.length > 0) {
      targetStatus = "OCCUPIED";
    }

    if (table.status !== targetStatus) {
      updates.push({ id: table.id, status: targetStatus });
    }
  }

  if (updates.length === 0) return;

  await Promise.all(
    updates.map((u) =>
      prisma.restaurantTable.update({
        where: { id: u.id },
        data: { status: u.status },
      })
    )
  );
}

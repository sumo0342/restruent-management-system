import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reconcileTableStatuses } from "@/lib/tableStatus";
import { branchScope } from "@/lib/branchScope";
import { getRestaurantBookings } from "@/lib/bookings";

export async function GET() {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    await reconcileTableStatuses(user.restaurantId);
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId: user.restaurantId, active: true, ...branchScope(user) },
      orderBy: { number: "asc" },
    });

    const todayStr = new Date().toISOString().split("T")[0];
    const bookings = getRestaurantBookings(user.restaurantId, user.branchId);
    const bookingByTable = new Map(
      bookings
        .filter((b) => b.bookingDate === todayStr && b.status === "CONFIRMED" && b.tableId)
        .map((b) => [b.tableId!, b])
    );

    return tables.map((t) => ({
      ...t,
      todayBooking: bookingByTable.get(t.id)
        ? {
            customerName: bookingByTable.get(t.id)!.customerName,
            bookingTime: bookingByTable.get(t.id)!.bookingTime,
            guestCount: bookingByTable.get(t.id)!.guestCount,
          }
        : null,
    }));
  });
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { reconcileTableStatuses } from "@/lib/tableStatus";
import { branchScope } from "@/lib/branchScope";
import { StickerBadge, StickerImage } from "@/components/Sticker";
import { getRestaurantBookings } from "@/lib/bookings";

export default async function WaiterTablesPage() {
  const user = await getCurrentUser();
  await reconcileTableStatuses(user!.restaurantId);
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: user!.restaurantId, active: true, ...branchScope(user!) },
    orderBy: { number: "asc" },
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const allBookings = getRestaurantBookings(user!.restaurantId, user!.branchId);
  const bookingByTable = new Map(
    allBookings
      .filter((b) => b.bookingDate === todayStr && b.status === "CONFIRMED" && b.tableId)
      .map((b) => [b.tableId!, b])
  );

  const groups = [
    { label: "Waiting for billing", statuses: ["WAITING_FOR_BILL"] },
    { label: "Food ready", statuses: ["FOOD_READY"] },
    { label: "Order pending", statuses: ["ORDER_PENDING"] },
    { label: "Occupied", statuses: ["OCCUPIED", "CLEANING"] },
    { label: "Available", statuses: ["AVAILABLE"] },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StickerBadge text="Floor Active" icon="⚡" variant="deepGreen" tilt="slight-left" />
            <span className="text-xs text-emerald-300 font-medium">{tables.length} dining tables</span>
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-[#FAF8F5]">Floor Tables</h1>
          <p className="text-[#9DB7AA] text-sm">Select any table to view status or place a new round.</p>
        </div>
        <div className="hidden sm:block">
          <StickerImage type="badge" size="xs" tilt="slight-right" />
        </div>
      </div>

      {groups.map((g) => {
        const list = tables.filter((t) => g.statuses.includes(t.status));
        if (list.length === 0) return null;
        return (
          <div key={g.label}>
            <p className="text-xs uppercase tracking-widest text-smoke mb-2">{g.label} ({list.length})</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 animate-stagger">
              {list.map((t) => (
                <Link key={t.id} href={`/waiter/order/${t.id}`} className="card-interactive p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-display text-2xl">{t.number}</p>
                    {bookingByTable.has(t.id) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 animate-pulse">
                        📅 {bookingByTable.get(t.id)!.bookingTime}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-smoke mb-2">{t.capacity} seats</p>
                  <StatusPill status={t.status} />
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

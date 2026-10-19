import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { formatTime } from "@/lib/utils";
import { OrderBuilder } from "./OrderBuilder";
import { branchScope, menuScopeForTable } from "@/lib/branchScope";
import { StickerBadge, StickerImage } from "@/components/Sticker";

export default async function NewOrderPage({ params }: { params: { tableId: string } }) {
  const user = await getCurrentUser();
  const table = await prisma.restaurantTable.findFirst({
    where: { id: params.tableId, restaurantId: user!.restaurantId, ...branchScope(user!) },
  });
  if (!table) notFound();

  const [categories, session] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { restaurantId: user!.restaurantId, active: true, ...menuScopeForTable(table.branchId) },
      include: {
        items: { where: { ...menuScopeForTable(table.branchId) }, orderBy: { name: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.tableSession.findFirst({
      where: {
        tableId: table.id,
        OR: [{ closedAt: null }, { closedAt: { isSet: false } }],
      },
      include: { orders: { include: { items: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { openedAt: "desc" },
    }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6">
      {/* Page Header with Decorative Deep Green & Off-White Stickers */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <StickerBadge text={`Table ${table.number}`} icon="🍽️" variant="offWhite" tilt="slight-left" />
            <StickerBadge text="Dine In" icon="🌿" variant="deepGreen" tilt="slight-right" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-[#FAF8F5]">New order round</h1>
          <p className="text-xs text-emerald-300/80 font-medium">Select delicious dishes for table guests</p>
        </div>

        <div className="shrink-0 hidden sm:block">
          <StickerImage type="food" size="sm" tilt="slight-right" />
        </div>
      </div>

      {session && session.orders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-widest text-[#9DB7AA] font-bold">Already ordered this session</p>
            <span className="text-[11px] text-emerald-400 font-semibold">{session.orders.length} round{session.orders.length > 1 ? "s" : ""}</span>
          </div>
          <div className="card divide-y divide-white/10">
            {session.orders.map((o) => {
              const isParcel = o.customerNote?.includes("PARCEL");
              return (
                <div key={o.id} className="p-3.5 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors">
                  <div className="text-sm">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-semibold text-white">Order #{o.orderNumber}</span>
                      {isParcel ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                          📦 Parcel
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                          🍽️ Dine In
                        </span>
                      )}
                    </div>
                    <span className="text-emerald-100/70 text-xs">
                      {formatTime(o.createdAt)} · {o.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join(", ")}
                    </span>
                  </div>
                  <StatusPill status={o.status} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <OrderBuilder tableId={table.id} categories={categories as any} />
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { createBranchAction, toggleBranchActiveAction } from "@/lib/actions/owner";

export default async function BranchesPage() {
  const user = await getCurrentUser();
  const branches = await prisma.branch.findMany({
    where: { restaurantId: user!.restaurantId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { tables: true, users: true, menuItems: true } },
    },
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Branches</h1>
        <p className="text-smoke text-sm">
          Optional — split tables, staff and menu across multiple physical locations. If you
          never create one, everything stays exactly as it is today: one shared floor, one menu.
        </p>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold mb-3">New branch</p>
        <form action={createBranchAction} className="grid sm:grid-cols-2 gap-3">
          <input name="name" placeholder="e.g. Riverside" required className="input" />
          <input name="address" placeholder="Address (optional)" className="input" />
          <button className="btn-primary sm:col-span-2">Create branch</button>
        </form>
      </div>

      <div className="card divide-y divide-line animate-stagger">
        {branches.map((b) => (
          <div key={b.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="font-medium">{b.name}</p>
              {b.address && <p className="text-xs text-smoke">{b.address}</p>}
              <p className="text-xs text-smoke mt-1">
                {b._count.tables} table{b._count.tables !== 1 ? "s" : ""} ·{" "}
                {b._count.users} staff · {b._count.menuItems} menu item{b._count.menuItems !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={b.active ? "COMPLETED" : "CANCELLED"} />
              <form action={toggleBranchActiveAction.bind(null, b.id)}>
                <button className={b.active ? "btn-danger !px-2 !py-1 text-xs" : "btn-secondary !px-2 !py-1 text-xs"}>
                  {b.active ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            </div>
          </div>
        ))}
        {branches.length === 0 && (
          <p className="p-6 text-sm text-smoke text-center">
            No branches yet — this restaurant runs as a single location. Assign staff and tables to
            a branch from the Users and Tables pages once you create one here.
          </p>
        )}
      </div>
    </div>
  );
}

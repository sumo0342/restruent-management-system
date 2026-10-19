import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { createTableAction, toggleTableActiveAction, updateTableBranchAction } from "@/lib/actions/owner";
import { reconcileTableStatuses } from "@/lib/tableStatus";

export default async function TablesPage() {
  const user = await getCurrentUser();
  await reconcileTableStatuses(user!.restaurantId);
  const [tables, branches] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: user!.restaurantId },
      orderBy: { number: "asc" },
      include: { branch: { select: { name: true } } },
    }),
    prisma.branch.findMany({ where: { restaurantId: user!.restaurantId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Tables</h1>
        <p className="text-smoke text-sm">Add tables and monitor their live status.</p>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold mb-3">New table</p>
        <form action={createTableAction} className={`grid gap-2 ${branches.length > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          <input name="number" placeholder="Table #" required className="input" />
          <input name="capacity" type="number" placeholder="Seats" required className="input" />
          <input name="section" placeholder="Section (optional)" className="input" />
          {branches.length > 0 && (
            <select name="branchId" className="input">
              <option value="">No branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button className="btn-primary">Add table</button>
        </form>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 animate-stagger">
        {tables.map((t) => (
          <div key={t.id} className={`card-lift p-4 ${!t.active ? "opacity-50" : ""}`}>
            <p className="font-display text-xl">Table {t.number}</p>
            <p className="text-xs text-smoke mb-2">
              {t.capacity} seats{t.section ? ` · ${t.section}` : ""}
              {t.branch ? ` · ${t.branch.name}` : ""}
            </p>
            <StatusPill status={t.status} />
            {branches.length > 0 && (
              <form action={updateTableBranchAction} className="mt-2 flex gap-1">
                <input type="hidden" name="tableId" value={t.id} />
                <select name="branchId" defaultValue={t.branchId ?? ""} className="input !py-1 !text-xs flex-1">
                  <option value="">No branch</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button className="btn-secondary !py-1 !px-2 text-xs">Set</button>
              </form>
            )}
            <form action={toggleTableActiveAction.bind(null, t.id)} className="mt-2">
              <button className="btn-secondary !py-1 !px-2 text-xs w-full">
                {t.active ? "Deactivate" : "Reactivate"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}

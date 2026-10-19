import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { createMaintenanceAction, updateMaintenanceStatusAction } from "@/lib/actions/owner";
import { formatDateTime, formatMoney } from "@/lib/utils";

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  const records = await prisma.maintenanceRecord.findMany({
    where: { restaurantId: user!.restaurantId },
    include: { reportedBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Maintenance</h1>
        <p className="text-smoke text-sm">Track equipment issues from report to resolution.</p>
      </div>

      <div className="card p-4">
        <form action={createMaintenanceAction} className="space-y-2">
          <div className="grid sm:grid-cols-2 gap-2">
            <input name="equipment" placeholder="Equipment (e.g. Refrigerator)" required className="input" />
            <select name="priority" className="input" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <textarea name="problem" placeholder="Describe the problem" required className="input" rows={2} />
          <input name="assignedTo" placeholder="Assigned to (optional)" className="input" />
          <button className="btn-primary w-full">Log issue</button>
        </form>
      </div>

      <div className="card divide-y divide-line">
        {records.map((r) => (
          <div key={r.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.equipment}</p>
                <p className="text-sm text-smoke">{r.problem}</p>
                <p className="text-xs text-smoke mt-1">
                  Reported by {r.reportedBy.name} · {formatDateTime(r.createdAt)}
                  {r.assignedTo ? ` · Assigned to ${r.assignedTo}` : ""}
                  {r.cost ? ` · ${formatMoney(r.cost)}` : ""}
                </p>
              </div>
              <StatusPill status={r.priority} />
            </div>
            <form action={updateMaintenanceStatusAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={r.id} />
              <select name="status" defaultValue={r.status} className="input !py-1 !text-xs w-40">
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <input name="cost" type="number" step="0.01" placeholder="Cost" className="input !py-1 !text-xs w-24" />
              <button className="btn-secondary !py-1 !px-2 text-xs">Update</button>
            </form>
          </div>
        ))}
        {records.length === 0 && <p className="p-6 text-sm text-smoke text-center">No maintenance records yet.</p>}
      </div>
    </div>
  );
}

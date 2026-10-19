import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { createNoteAction, toggleNoteStatusAction } from "@/lib/actions/owner";
import { formatDateTime } from "@/lib/utils";

export default async function NotesPage() {
  const user = await getCurrentUser();
  const notes = await prisma.note.findMany({
    where: { restaurantId: user!.restaurantId },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Notes</h1>
        <p className="text-smoke text-sm">Reminders and internal notes for the team.</p>
      </div>

      <div className="card p-4">
        <form action={createNoteAction} className="space-y-2">
          <input name="title" placeholder="e.g. Order more Coke" required className="input" />
          <textarea name="description" placeholder="Details (optional)" className="input" rows={2} />
          <select name="priority" className="input" defaultValue="MEDIUM">
            <option value="LOW">Low priority</option>
            <option value="MEDIUM">Medium priority</option>
            <option value="HIGH">High priority</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button className="btn-primary w-full">Add note</button>
        </form>
      </div>

      <div className="card divide-y divide-line">
        {notes.map((n) => (
          <div key={n.id} className="p-4 flex items-start justify-between gap-3">
            <div>
              <p className={`font-medium ${n.status === "DONE" ? "line-through text-smoke" : ""}`}>{n.title}</p>
              {n.description && <p className="text-sm text-smoke mt-0.5">{n.description}</p>}
              <p className="text-xs text-smoke mt-1">{n.createdBy.name} · {formatDateTime(n.createdAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <StatusPill status={n.priority} />
              <form action={toggleNoteStatusAction.bind(null, n.id)}>
                <button className="btn-secondary !py-1 !px-2 text-xs">
                  {n.status === "OPEN" ? "Mark done" : "Reopen"}
                </button>
              </form>
            </div>
          </div>
        ))}
        {notes.length === 0 && <p className="p-6 text-sm text-smoke text-center">No notes yet.</p>}
      </div>
    </div>
  );
}

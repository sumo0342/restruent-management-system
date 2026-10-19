import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  const logs = await prisma.auditLog.findMany({
    where: { restaurantId: user!.restaurantId },
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-4">
      <div>
        <h1 className="font-display text-2xl">Audit log</h1>
        <p className="text-smoke text-sm">Every important action, most recent 200. Not editable by anyone.</p>
      </div>

      <div className="card divide-y divide-line text-sm">
        {logs.map((l) => (
          <div key={l.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-mono text-xs text-smoke">{formatDateTime(l.createdAt)}</span>{" "}
              <span className="font-medium">{l.user ? `${l.user.name} (${l.user.role})` : "System"}</span>{" "}
              <span className="text-ink/70">— {l.action.replace(/_/g, " ").toLowerCase()}</span>
            </div>
            {l.details && <span className="text-xs text-smoke">{l.details}</span>}
          </div>
        ))}
        {logs.length === 0 && <p className="p-6 text-center text-smoke">No activity yet.</p>}
      </div>
    </div>
  );
}

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/Avatar";
import {
  createUserAction,
  toggleUserActiveAction,
  updateUserBranchAction,
} from "@/lib/actions/owner";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function UsersPage() {
  const user = await getCurrentUser();
  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      where: { restaurantId: user!.restaurantId },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { branch: { select: { name: true } } },
    }),
    prisma.branch.findMany({ where: { restaurantId: user!.restaurantId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Users</h1>
        <p className="text-smoke text-sm">Create staff accounts and manage access.</p>
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold mb-3">Add a staff member</p>
        <form action={createUserAction} className="grid sm:grid-cols-2 gap-3">
          <input name="name" placeholder="Full name" required className="input" />
          <input name="email" type="email" placeholder="Email" required className="input" />
          <input
            name="password"
            type="password"
            placeholder="Temporary password (min 8 chars)"
            required
            minLength={8}
            className="input"
          />
          <select name="role" required className="input">
            <option value="">Select role</option>
            <option value="MANAGER">Manager / Cashier</option>
            <option value="KITCHEN">Kitchen / Chef</option>
            <option value="WAITER">Waiter</option>
            <option value="OWNER">Owner</option>
          </select>
          {branches.length > 0 && (
            <select name="branchId" className="input sm:col-span-2">
              <option value="">No branch (sees only unassigned floor)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <button className="btn-primary sm:col-span-2">Create account</button>
        </form>
      </div>

      <div className="card divide-y divide-line animate-stagger">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={u.name} />
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-smoke">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="status-pill bg-panel text-ink">{u.role}</span>
              <StatusPill status={u.active ? "COMPLETED" : "CANCELLED"} />
              {branches.length > 0 && (
                <form action={updateUserBranchAction} className="flex items-center gap-1">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="branchId" defaultValue={u.branchId ?? ""} className="input !py-1 !text-xs w-32">
                    <option value="">No branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <button className="btn-secondary !px-2 !py-1 text-xs">Set</button>
                </form>
              )}
              <ResetPasswordForm userId={u.id} userName={u.name} />
              {u.id === user?.id ? (
                <span className="text-xs text-smoke/60 px-2 py-1 italic">(Current user)</span>
              ) : (
                <form action={toggleUserActiveAction.bind(null, u.id)}>
                  <button className={u.active ? "btn-danger !px-2 !py-1 text-xs" : "btn-secondary !px-2 !py-1 text-xs"}>
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { SessionUser } from "@/lib/auth";

/**
 * Returns the Prisma where-clause fragment that scopes a query to the
 * current user's branch.
 *
 * - OWNER always sees every branch (and legacy, branch-less data) for their
 *   restaurant, so this returns an empty filter for them — spread it into a
 *   `where` object and it's a no-op.
 * - Everyone else is scoped to their own branchId. A staff member with no
 *   branchId (the default, and the only possibility for a restaurant that
 *   has never created a branch) only matches branchId: null data — so
 *   nothing changes for restaurants that never adopt branches.
 *
 * Usage: `where: { restaurantId: user.restaurantId, ...branchScope(user) }`
 */
export function branchScope(user: SessionUser): { branchId?: string | null } {
  if (user.role === "OWNER") return {};
  return { branchId: user.branchId ?? null };
}

/**
 * Menu items/categories are allowed to be branch-specific OR shared across
 * every branch (branchId: null). When a table belongs to a branch, its menu
 * is "that branch's items, plus anything shared". When a table has no
 * branch, only shared (branchId: null) items apply.
 *
 * Deliberately returns an `OR` clause rather than `branchId: { in: [id, null] }`
 * — MongoDB's Prisma connector rejects an `in` list that mixes a string
 * with `null` ("Expected ListStringFieldRefInput or Null, provided
 * (String, Null)"), even though the Postgres connector allows it. `OR` of
 * two single-value filters works on every connector.
 *
 * Usage: `where: { restaurantId, ...menuScopeForTable(table.branchId) }`
 * — safe to spread alongside other filters as long as the same `where`
 * doesn't already use its own top-level `OR`.
 */
export function menuScopeForTable(tableBranchId: string | null): {
  OR?: [{ branchId: string }, { branchId: null }];
  branchId?: null;
} {
  if (!tableBranchId) return { branchId: null };
  return { OR: [{ branchId: tableBranchId }, { branchId: null }] };
}

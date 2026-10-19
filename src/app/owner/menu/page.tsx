import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/utils";
import {
  createCategoryAction,
  createMenuItemAction,
  toggleMenuItemAvailabilityAction,
  deactivateMenuItemAction,
} from "@/lib/actions/owner";

export default async function MenuPage() {
  const user = await getCurrentUser();
  const [categories, restaurant, branches] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { restaurantId: user!.restaurantId, active: true },
      include: { items: { orderBy: { name: "asc" } }, branch: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.restaurant.findUnique({ where: { id: user!.restaurantId } }),
    prisma.branch.findMany({ where: { restaurantId: user!.restaurantId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl">Menu</h1>
        <p className="text-smoke text-sm">Categories, items, prices and availability.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="text-sm font-semibold mb-3">New category</p>
          <form action={createCategoryAction} className="space-y-2">
            <input name="name" placeholder="e.g. Starters" required className="input" />
            {branches.length > 0 && (
              <select name="branchId" className="input">
                <option value="">Shared across every branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} only</option>
                ))}
              </select>
            )}
            <button className="btn-primary w-full">Add</button>
          </form>
        </div>

        <div className="card p-4">
          <p className="text-sm font-semibold mb-3">New item</p>
          <form action={createMenuItemAction} className="space-y-2">
            <input name="name" placeholder="Item name" required className="input" />
            <div className="grid grid-cols-2 gap-2">
              <input name="price" type="number" step="0.01" placeholder={`Price (${restaurant?.currencySymbol ?? "₹"})`} required className="input" />
              <select name="categoryId" required className="input">
                <option value="">Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.branch ? ` (${c.branch.name})` : ""}</option>
                ))}
              </select>
            </div>
            <textarea name="description" placeholder="Description (optional)" className="input" rows={2} />
            <div className="flex items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="isVeg" defaultChecked /> Veg</label>
              <label className="flex items-center gap-2">Prep mins <input name="prepTimeMins" type="number" defaultValue={10} className="input w-16 !py-1" /></label>
            </div>
            <button className="btn-primary w-full">Add item</button>
          </form>
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat.id}>
            <p className="text-xs uppercase tracking-widest text-smoke mb-2">
              {cat.name}{cat.branch ? ` · ${cat.branch.name} only` : ""}
            </p>
            <div className="card divide-y divide-line">
              {cat.items.length === 0 && <p className="p-4 text-sm text-smoke">No items yet.</p>}
              {cat.items.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.name} <span className="text-smoke font-normal">· {formatMoney(item.price, restaurant?.currencySymbol)}</span>
                    </p>
                    {!item.available && <span className="text-xs text-flame">Out of stock</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <form action={toggleMenuItemAvailabilityAction.bind(null, item.id)}>
                      <button className={item.available ? "btn-secondary !px-2 !py-1 text-xs" : "btn-primary !px-2 !py-1 text-xs"}>
                        {item.available ? "Mark out of stock" : "Mark available"}
                      </button>
                    </form>
                    <form action={deactivateMenuItemAction.bind(null, item.id)}>
                      <button className="btn-danger !px-2 !py-1 text-xs">Deactivate</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

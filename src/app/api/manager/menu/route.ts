export const dynamic = "force-dynamic";

import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";

export async function GET() {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const categories = await prisma.menuCategory.findMany({
      where: {
        restaurantId: user.restaurantId,
        active: true,
        ...branchScope(user),
      },
      include: {
        items: {
          where: { available: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
    return categories;
  });
}

import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";

export async function GET() {
  return withRole(["KITCHEN", "OWNER"], async (user) => {
    const orders = await prisma.order.findMany({
      where: {
        restaurantId: user.restaurantId,
        status: { in: ["PENDING", "PREPARING"] },
        ...branchScope(user),
      },
      include: {
        table: true,
        waiter: { select: { name: true } },
        items: true,
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return orders;
  });
}

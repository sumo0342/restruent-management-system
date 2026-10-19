export const dynamic = "force-dynamic";

import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";

export async function GET() {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const bills = await prisma.bill.findMany({
      where: {
        restaurantId: user.restaurantId,
        ...branchScope(user),
      },
      include: {
        session: { include: { table: true } },
        issuedBy: { select: { name: true } },
        payments: true,
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return bills;
  });
}

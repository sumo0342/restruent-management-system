import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export async function GET() {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const shift = await prisma.shift.findFirst({
      where: { cashierId: user.id, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    });
    return shift;
  });
}

const schema = z.object({ openingCash: z.number().min(0) });

export async function POST(req: Request) {
  return withRole(["MANAGER", "OWNER"], async (user) => {
    const body = schema.parse(await req.json());
    const existing = await prisma.shift.findFirst({
      where: { cashierId: user.id, status: "OPEN" },
    });
    if (existing) throw new Error("You already have an open shift.");

    const shift = await prisma.shift.create({
      data: {
        restaurantId: user.restaurantId,
        branchId: user.branchId,
        cashierId: user.id,
        openingCash: body.openingCash,
      },
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "SHIFT_OPENED",
      entityType: "Shift",
      entityId: shift.id,
      details: `Opening cash ₹${body.openingCash}`,
    });

    return shift;
  });
}

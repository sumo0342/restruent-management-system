import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  restaurantId: string;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
}) {
  await prisma.auditLog.create({
    data: {
      restaurantId: params.restaurantId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details,
    },
  });
}

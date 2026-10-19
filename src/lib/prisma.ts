import { PrismaClient } from "@prisma/client";

function getMongoUrl(): string | undefined {
  let url = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!url) return undefined;
  // If URL ends at host domain without database name, append /rms?retryWrites=true&w=majority
  if (/cluster[^\/]+\.mongodb\.net\/?$/.test(url)) {
    url = url.replace(/\/?$/, "/rms?retryWrites=true&w=majority");
  } else if (!url.includes("retryWrites=true")) {
    url = url.includes("?") ? `${url}&retryWrites=true&w=majority` : `${url}?retryWrites=true&w=majority`;
  }
  process.env.DATABASE_URL = url;
  return url;
}

const resolvedUrl = getMongoUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: resolvedUrl ? { db: { url: resolvedUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

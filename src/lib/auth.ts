import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import type { Role } from "@/lib/enums";

const SESSION_COOKIE = "rms_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Very small in-memory rate limiter for the login endpoint.
// Good enough for a single-instance demo; swap for a Redis-backed limiter
// (e.g. Upstash) before running multiple instances in production.
// ---------------------------------------------------------------------------
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

export async function createSession(userId: string) {
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });

  cookies().set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });

  return session;
}

export async function destroySession() {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
  }
  cookies().delete(SESSION_COOKIE);
}

// User.role is a plain `string` column — kept as a string rather than a
// native Prisma enum for portability across database engines (see
// src/lib/enums.ts) — narrowed back to the Role union here for type safety
// everywhere else in the app.
export type SessionUser = Omit<
  Pick<User, "id" | "name" | "email" | "role" | "restaurantId" | "active" | "branchId">,
  "role"
> & { role: Role };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }

  const { id, name, email, role, restaurantId, active, branchId } = session.user;
  return { id, name, email, role: role as Role, restaurantId, active, branchId };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("UNAUTHENTICATED");
    err.name = "UNAUTHENTICATED";
    throw err;
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    const err = new Error("FORBIDDEN");
    err.name = "FORBIDDEN";
    throw err;
  }
  return user;
}

export const ROLE_HOME: Record<Role, string> = {
  OWNER: "/owner/dashboard",
  MANAGER: "/manager/dashboard",
  KITCHEN: "/kitchen/display",
  WAITER: "/waiter/tables",
};

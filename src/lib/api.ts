import { NextResponse } from "next/server";
import type { Role } from "@/lib/enums";
import { requireRole, type SessionUser } from "@/lib/auth";

export async function withRole<T>(
  roles: Role[],
  handler: (user: SessionUser) => Promise<T>
): Promise<NextResponse> {
  try {
    const user = await requireRole(...roles);
    const data = await handler(user);
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    if (err.name === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, error: "Please log in." }, { status: 401 });
    }
    if (err.name === "FORBIDDEN") {
      return NextResponse.json({ ok: false, error: "You don't have permission to do that." }, { status: 403 });
    }
    console.error(err);
    return NextResponse.json(
      { ok: false, error: err.message ?? "Something went wrong." },
      { status: 400 }
    );
  }
}

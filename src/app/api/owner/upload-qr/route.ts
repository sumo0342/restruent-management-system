import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import fs from "fs/promises";
import path from "path";
import os from "os";

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const UPLOADS_DIR = isServerless
  ? path.join(os.tmpdir(), "uploads")
  : path.join(process.cwd(), "public", "uploads");
const QR_FILE = path.join(UPLOADS_DIR, "owner-qr.png");
const CONFIG_FILE = path.join(UPLOADS_DIR, "qr-config.json");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readConfig() {
  try {
    if (await fileExists(CONFIG_FILE)) {
      const data = await fs.readFile(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    // fallback
  }
  return {
    activeType: "CUSTOM",
    url: "/api/owner/upload-qr?file=1",
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("file") === "1") {
    try {
      if (await fileExists(QR_FILE)) {
        const fileBuffer = await fs.readFile(QR_FILE);
        return new Response(fileBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=60",
          },
        });
      }
    } catch {
      // not found
    }
    return new Response("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const hasCustom = await fileExists(QR_FILE);
  const config = await readConfig();
  const qrUrl = hasCustom ? "/api/owner/upload-qr?file=1" : null;

  return NextResponse.json({
    ok: true,
    data: {
      hasCustomQr: hasCustom,
      customQrUrl: qrUrl,
      activeType: hasCustom ? (config.activeType || "CUSTOM") : "DYNAMIC",
      activeQrUrl: qrUrl,
      updatedAt: config.updatedAt,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ ok: false, error: "Forbidden. Owner access required." }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("qrFile") as File | null;

    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    if (file && typeof file === "object" && file.size > 0) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, error: "Invalid file type. Please upload an image file (PNG, JPG, WEBP)." },
          { status: 400 }
        );
      }

      // Max size: 5MB
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: "File too large. Maximum allowed size is 5MB." },
          { status: 400 }
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fs.writeFile(QR_FILE, buffer);
    }

    const hasCustom = await fileExists(QR_FILE);

    const config = {
      activeType: hasCustom ? "CUSTOM" : "DYNAMIC",
      url: hasCustom ? "/api/owner/upload-qr?file=1" : null,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "SETTINGS_UPDATED",
      details: "Owner uploaded custom payment QR code",
    });

    return NextResponse.json({
      ok: true,
      data: {
        hasCustomQr: hasCustom,
        activeType: config.activeType,
        activeQrUrl: config.url,
      },
    });
  } catch (err: any) {
    console.error("Failed to upload QR code:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to save QR code." }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user || user.role !== "OWNER") {
    return NextResponse.json({ ok: false, error: "Forbidden. Owner access required." }, { status: 403 });
  }

  try {
    if (await fileExists(QR_FILE)) {
      await fs.unlink(QR_FILE);
    }

    const config = {
      activeType: "DYNAMIC",
      url: null,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "SETTINGS_UPDATED",
      details: "Owner removed custom QR and reset to dynamic UPI QR mode",
    });

    return NextResponse.json({ ok: true, message: "Custom QR removed successfully." });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Failed to remove QR code." }, { status: 500 });
  }
}

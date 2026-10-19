import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";

// Renders whatever `text` query param is given as a QR PNG. Kept generic
// (not bill-specific) so it just needs a logged-in session — the actual
// UPI amount/payee is baked into the `text` by the caller (see lib/upi.ts).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const text = new URL(req.url).searchParams.get("text");
  if (!text) return new Response("Missing text", { status: 400 });

  const png = await QRCode.toBuffer(text, { width: 320, margin: 1, color: { dark: "#1A1D1E" } });
  return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

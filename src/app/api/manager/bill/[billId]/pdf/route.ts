export const dynamic = "force-dynamic";

import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";

export async function GET(req: Request, { params }: { params: { billId: string } }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== "MANAGER" && user.role !== "OWNER") {
    return new Response("You don't have permission to do that.", { status: 403 });
  }

  const url = new URL(req.url);
  const isInline = url.searchParams.get("inline") === "1";

  const bill = await prisma.bill.findFirst({
    where: { id: params.billId, restaurantId: user.restaurantId, ...branchScope(user) },
    include: {
      payments: true,
      session: {
        include: {
          table: true,
          orders: { include: { items: true }, orderBy: { createdAt: "asc" } },
        },
      },
      restaurant: true,
    },
  });
  if (!bill) return new Response("Bill not found.", { status: 404 });

  const items = bill.session.orders.flatMap((o) => o.items);
  const table = bill.session.table;

  // Generate UPI QR code for Restaurant Scan & Pay
  const upiId = bill.restaurant.upiId || "";
  const payeeName = bill.restaurant.name || "Restaurant";
  let qrBuffer: Buffer | null = null;

  if (upiId) {
    const upiText = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${bill.total.toFixed(2)}&cu=INR&tn=Bill%20${bill.billNumber}`;
    try {
      qrBuffer = await QRCode.toBuffer(upiText, { width: 140, margin: 1, color: { dark: "#1A1D1E" } });
    } catch (e) {
      console.error("QR generation error:", e);
    }
  }

  try {
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [227, 720], margin: 14 }); // ~80mm thermal-receipt width
      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const line = () => doc.moveDown(0.2).text("- ".repeat(38), { align: "center" }).moveDown(0.2);
      const row = (left: string, right: string, opts: { bold?: boolean } = {}) => {
        doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);
        const y = doc.y;
        doc.text(left, 14, y, { width: 140 });
        doc.text(right, 14, y, { width: 199, align: "right" });
      };

      doc.font("Helvetica-Bold").fontSize(12).text(bill.restaurant.name, { align: "center" });
      doc.font("Helvetica").fontSize(8);
      if (bill.restaurant.address) doc.text(bill.restaurant.address, { align: "center" });
      if (bill.restaurant.phone) doc.text(bill.restaurant.phone, { align: "center" });
      if (bill.restaurant.gstin) doc.text(`GSTIN: ${bill.restaurant.gstin}`, { align: "center" });
      line();

      doc.text(`Bill #${bill.billNumber}`);
      doc.text(`Table ${table?.number ?? "-"}`);
      doc.text(`Date: ${bill.createdAt.toLocaleString("en-IN")}`);
      line();

      row("Item", "Amt", { bold: true });
      doc.moveDown(0.3);
      for (const i of items) {
        row(`${i.quantity}x ${i.nameSnapshot}`, i.total.toFixed(2));
        doc.moveDown(0.15);
      }
      line();

      row("Subtotal", bill.subtotal.toFixed(2));
      doc.moveDown(0.15);
      row("Tax", bill.taxAmount.toFixed(2));
      doc.moveDown(0.15);
      if (bill.serviceCharge > 0) {
        row("Service charge", bill.serviceCharge.toFixed(2));
        doc.moveDown(0.15);
      }
      if (bill.discountAmount > 0) {
        row("Discount", `-${bill.discountAmount.toFixed(2)}`);
        doc.moveDown(0.15);
      }
      row("TOTAL", bill.total.toFixed(2), { bold: true });
      doc.moveDown(0.3);
      line();

      for (const p of bill.payments) {
        row(p.method, p.amount.toFixed(2));
        doc.moveDown(0.15);
      }
      doc.moveDown(0.2);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(
          bill.status === "PAID" || bill.status === "CLOSED" ? "PAID" : "UNPAID — awaiting payment",
          { align: "center" }
        );

      if (qrBuffer) {
        doc.moveDown(0.3);
        line();
        doc.font("Helvetica-Bold").fontSize(8).text("SCAN TO PAY VIA UPI", { align: "center" });
        doc.font("Helvetica").fontSize(7).text("Google Pay · PhonePe · Paytm · BHIM", { align: "center" });
        doc.moveDown(0.2);
        const qrX = Math.round((227 - 80) / 2);
        doc.image(qrBuffer, qrX, doc.y, { width: 80, height: 80 });
        doc.y += 84;
        doc.font("Helvetica-Bold").fontSize(7).text(`UPI VPA: ${upiId}`, { align: "center" });
        doc.font("Helvetica").fontSize(7).text(`Payee: ${payeeName}`, { align: "center" });
      }

      if (bill.restaurant.invoiceFooter) {
        doc.moveDown(0.4).font("Helvetica").fontSize(8).text(bill.restaurant.invoiceFooter, { align: "center" });
      }

      doc.end();
    });

    const disposition = isInline
      ? `inline; filename="bill-${bill.billNumber}.pdf"`
      : `attachment; filename="bill-${bill.billNumber}.pdf"`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("PDF generation failed:", err);
    return new Response(`Error generating PDF: ${err.message}`, { status: 500 });
  }
}

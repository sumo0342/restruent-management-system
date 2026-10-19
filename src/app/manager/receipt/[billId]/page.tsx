import { notFound } from "next/navigation";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";
import { branchScope } from "@/lib/branchScope";
import { PrintButton } from "./PrintButton";
import { SendReceiptMobileButton } from "./SendReceiptMobileButton";
import { ArrowLeft, CheckCircle2, Download, Printer, ShieldCheck } from "lucide-react";

function formatMethodName(method: string) {
  switch (method) {
    case "CASH":
      return "Cash Payment";
    case "CARD":
      return "Card Terminal (POS)";
    case "UPI":
      return "UPI Scan & Pay";
    case "GATEWAY":
      return "Razorpay Online Gateway";
    case "NET_BANKING":
      return "NetBanking (IMPS/NEFT)";
    case "WALLET":
      return "Digital Wallet";
    default:
      return method;
  }
}

export default async function ReceiptPage({ params }: { params: { billId: string } }) {
  const user = await getCurrentUser();
  const bill = await prisma.bill.findFirst({
    where: { id: params.billId, restaurantId: user!.restaurantId, ...branchScope(user!) },
    include: {
      payments: true,
      session: {
        include: {
          orders: { include: { items: true, waiter: true }, orderBy: { createdAt: "asc" } },
          table: true,
        },
      },
      restaurant: true,
    },
  });
  if (!bill) notFound();

  let customQrImage: string | null = null;
  try {
    const configPath = path.join(process.cwd(), "public", "uploads", "qr-config.json");
    const customImgPath = path.join(process.cwd(), "public", "uploads", "owner-qr.png");
    if (fs.existsSync(configPath) && fs.existsSync(customImgPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.activeType === "CUSTOM") {
        customQrImage = `/uploads/owner-qr.png?v=${config.updatedAt || Date.now()}`;
      }
    }
  } catch {}

  const table = bill.session.table;
  const items = bill.session.orders.flatMap((o) => o.items);
  const isPaid = bill.status === "PAID" || bill.status === "CLOSED";

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center p-4 sm:p-6 print:p-0 print:bg-white animate-page">
      {/* Top Navigation Bar (Hidden in Print) */}
      <div className="w-full max-w-sm mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/manager/billing${table ? `?table=${table.id}` : ""}`}
          className="text-xs font-semibold text-smoke hover:text-ink flex items-center gap-1.5"
        >
          <ArrowLeft size={14} />
          <span>Back to Billing</span>
        </Link>
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white border border-line text-ink">
          Bill #{bill.billNumber}
        </span>
      </div>

      {/* Modern Thermal Receipt Slip */}
      <div className="w-full max-w-sm bg-white card p-6 font-mono text-sm shadow-md print:border-none print:shadow-none print:p-2 border border-line">
        {/* Receipt Header */}
        <div className="text-center mb-4 space-y-0.5">
          <div className="inline-block p-1.5 rounded-full bg-emerald-100 text-emerald-800 mb-1 print:hidden">
            <CheckCircle2 size={18} />
          </div>
          <h2 className="font-display text-xl font-bold text-ink">{bill.restaurant.name}</h2>
          {bill.restaurant.address && <p className="text-xs text-smoke">{bill.restaurant.address}</p>}
          {bill.restaurant.phone && <p className="text-xs text-smoke">Tel: {bill.restaurant.phone}</p>}
          {bill.restaurant.gstin && (
            <p className="text-xs font-semibold text-ink">GSTIN: {bill.restaurant.gstin}</p>
          )}
        </div>

        {/* Bill Metadata */}
        <div className="border-t border-b border-dashed border-line py-2 mb-2 text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Bill No: #{bill.billNumber}</span>
            <span>Table: {table?.number ?? "-"}</span>
          </div>
          <div className="flex justify-between">
            <span>Date: {formatDateTime(bill.createdAt)}</span>
            <span>Type: {bill.session.orders.some((o) => o.customerNote?.includes("PARCEL")) ? "📦 PARCEL" : "🍽️ DINE IN"}</span>
          </div>
        </div>

        {/* Order Items Table */}
        <table className="w-full text-xs mb-2">
          <thead>
            <tr className="text-left border-b border-line text-smoke uppercase text-[10px]">
              <th className="py-1">Item Description</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Rate</th>
              <th className="text-right">Amt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {items.map((i) => (
              <tr key={i.id}>
                <td className="py-1 pr-1 font-medium">{i.nameSnapshot}</td>
                <td className="text-right py-1">{i.quantity}</td>
                <td className="text-right py-1">₹{i.unitPrice.toFixed(2)}</td>
                <td className="text-right py-1 font-semibold">₹{i.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Calculations Breakdown */}
        <div className="border-t border-dashed border-line pt-2 text-xs space-y-1">
          <div className="flex justify-between text-smoke">
            <span>Subtotal</span>
            <span>₹{bill.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-smoke">
            <span>GST / Tax ({bill.restaurant.taxPercent}%)</span>
            <span>₹{bill.taxAmount.toFixed(2)}</span>
          </div>
          {bill.serviceCharge > 0 && (
            <div className="flex justify-between text-smoke">
              <span>Service Charge</span>
              <span>₹{bill.serviceCharge.toFixed(2)}</span>
            </div>
          )}
          {bill.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-800 font-semibold">
              <span>Discount {bill.discountReason ? `(${bill.discountReason})` : ""}</span>
              <span>-₹{bill.discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base border-t-2 border-line pt-1.5 mt-1 text-ink">
            <span>GRAND TOTAL</span>
            <span className="text-flame">₹{bill.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Settlements */}
        <div className="border-t border-dashed border-line mt-3 pt-2 text-xs space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-smoke tracking-wider block">
            Payment Method &amp; Breakdown
          </span>
          {bill.payments.map((p) => (
            <div key={p.id} className="p-1.5 rounded bg-panel/40 border border-line/60">
              <div className="flex justify-between font-semibold">
                <span>{formatMethodName(p.method)}</span>
                <span>₹{p.amount.toFixed(2)}</span>
              </div>
              {p.transactionReference && (
                <p className="text-[10px] text-smoke mt-0.5 truncate font-mono">
                  Ref: {p.transactionReference}
                </p>
              )}
            </div>
          ))}

          {isPaid ? (
            <div className="text-center py-1 bg-emerald-100/70 border border-emerald-300 rounded text-emerald-900 font-bold tracking-wider text-xs mt-2">
              PAID IN FULL
            </div>
          ) : (
            <div className="text-center py-1 bg-rose-100 border border-rose-300 rounded text-rose-900 font-bold tracking-wider text-xs mt-2">
              UNPAID — AWAITING PAYMENT
            </div>
          )}
        </div>

        {/* UPI Scan & Pay QR */}
        <div className="border-t border-dashed border-line mt-3 pt-3 text-center space-y-1.5">
          <span className="text-[10px] uppercase font-bold text-smoke tracking-wider block">
            Scan to Pay via UPI
          </span>
          <div className="inline-block p-2 bg-white bg-white-solid qr-box rounded border border-line shadow-sm">
            <img
              src={
                customQrImage ||
                `/api/manager/qr?text=${encodeURIComponent(
                  `upi://pay?pa=${encodeURIComponent(
                    bill.restaurant.upiId || ""
                  )}&pn=${encodeURIComponent(bill.restaurant.name || "Restaurant")}&am=${bill.total.toFixed(2)}&cu=INR&tn=Bill%20${bill.billNumber}`
                )}`
              }
              alt="Payment QR Code"
              className="w-32 h-32 mx-auto object-contain"
            />
          </div>
          <div className="text-[10px] text-smoke font-mono">
            <p className="font-semibold text-ink">{bill.restaurant.name}</p>
            {bill.restaurant.upiId && <p>VPA: {bill.restaurant.upiId}</p>}
            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">
              GPay · PhonePe · Paytm · BHIM · Cred
            </p>
          </div>
        </div>

        {/* Invoice Footer */}
        {bill.restaurant.invoiceFooter && (
          <p className="text-center text-[11px] text-smoke mt-4 border-t border-line/60 pt-2 italic">
            "{bill.restaurant.invoiceFooter}"
          </p>
        )}

        <div className="text-center text-[10px] text-smoke mt-3">
          *** Thank you for dining with us! ***
        </div>
      </div>

      {/* Bottom Action Controls (Hidden in Print) */}
      <div className="print:hidden mt-4 flex flex-wrap gap-2 justify-center max-w-sm w-full">
        {!isPaid && table && (
          <Link href={`/manager/billing?table=${table.id}`} className="btn-primary flex-1 text-xs">
            Take Payment
          </Link>
        )}
        <SendReceiptMobileButton
          restaurantName={bill.restaurant.name}
          billNumber={bill.billNumber}
          tableNumber={table?.number}
          total={bill.total}
          upiId={bill.restaurant.upiId}
          isPaid={isPaid}
          items={items.map((i) => ({ quantity: i.quantity, nameSnapshot: i.nameSnapshot, total: i.total }))}
        />
        <a
          href={`/api/manager/bill/${bill.id}/pdf`}
          className="btn-secondary text-xs flex items-center justify-center gap-1.5 flex-1"
          download
        >
          <Download size={14} />
          <span>Download PDF</span>
        </a>
        <PrintButton />
      </div>
    </div>
  );
}

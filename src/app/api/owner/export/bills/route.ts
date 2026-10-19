import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

function csvEscape(value: string | number) {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const user = await requireRole("OWNER");
  const branchId = new URL(req.url).searchParams.get("branchId") || undefined;

  const bills = await prisma.bill.findMany({
    where: {
      restaurantId: user.restaurantId,
      status: { in: ["PAID", "CLOSED"] },
      ...(branchId ? { branchId: branchId === "none" ? null : branchId } : {}),
    },
    include: { session: { include: { table: true } }, issuedBy: { select: { name: true } } },
    orderBy: { paidAt: "desc" },
  });

  const header = [
    "Bill Number",
    "Table",
    "Subtotal",
    "Tax",
    "Service Charge",
    "Discount",
    "Total",
    "Issued By",
    "Paid At",
  ];

  const rows = bills.map((b) => [
    b.billNumber,
    b.session.table.number,
    b.subtotal.toFixed(2),
    b.taxAmount.toFixed(2),
    b.serviceCharge.toFixed(2),
    b.discountAmount.toFixed(2),
    b.total.toFixed(2),
    b.issuedBy.name,
    b.paidAt ? b.paidAt.toISOString() : "",
  ]);

  const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");

  await logAudit({ restaurantId: user.restaurantId, userId: user.id, action: "REPORT_EXPORTED", details: "bills.csv" });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="bills-export.csv"`,
    },
  });
}

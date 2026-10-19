export const dynamic = "force-dynamic";

import { withRole } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { branchScope } from "@/lib/branchScope";
import {
  getRestaurantBookings,
  createBooking,
  updateBooking,
  markBookingReminderSent,
  deleteBooking,
  buildWhatsAppReminder,
} from "@/lib/bookings";
import { z } from "zod";

const createSchema = z.object({
  customerName: z.string().min(2, "Customer name is required"),
  customerPhone: z.string().min(10, "Please enter a valid 10-digit mobile number"),
  guestCount: z.number().int().min(1).max(50),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: YYYY-MM-DD"),
  bookingTime: z.string().min(1, "Booking time is required"),
  tableId: z.string().optional().nullable(),
  tableNumber: z.string().optional().nullable(),
  specialNotes: z.string().optional().nullable(),
  autoSendWhatsApp: z.boolean().optional(),
});

const updateSchema = z.object({
  id: z.string(),
  status: z.enum(["CONFIRMED", "SEATED", "COMPLETED", "CANCELLED"]).optional(),
  tableId: z.string().optional().nullable(),
  tableNumber: z.string().optional().nullable(),
  guestCount: z.number().optional(),
  bookingDate: z.string().optional(),
  bookingTime: z.string().optional(),
  specialNotes: z.string().optional().nullable(),
  markReminderSent: z.boolean().optional(),
});

export async function GET() {
  return withRole(["OWNER", "MANAGER", "WAITER"], async (user) => {
    const [restaurant, tables] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: user.restaurantId },
        select: { id: true, name: true, phone: true, address: true },
      }),
      prisma.restaurantTable.findMany({
        where: { restaurantId: user.restaurantId, active: true, ...branchScope(user) },
        select: { id: true, number: true, capacity: true, section: true, status: true },
        orderBy: { number: "asc" },
      }),
    ]);

    const bookings = getRestaurantBookings(user.restaurantId, user.branchId);

    return {
      restaurant,
      tables,
      bookings,
    };
  });
}

export async function POST(req: Request) {
  return withRole(["OWNER", "MANAGER", "WAITER"], async (user) => {
    const body = createSchema.parse(await req.json());

    // Resolve table number if tableId provided but no tableNumber
    let finalTableNumber = body.tableNumber;
    if (body.tableId && !finalTableNumber) {
      const table = await prisma.restaurantTable.findUnique({ where: { id: body.tableId } });
      if (table) finalTableNumber = table.number;
    }

    const booking = createBooking({
      restaurantId: user.restaurantId,
      branchId: user.branchId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      guestCount: body.guestCount,
      bookingDate: body.bookingDate,
      bookingTime: body.bookingTime,
      tableId: body.tableId,
      tableNumber: finalTableNumber,
      specialNotes: body.specialNotes,
      createdById: user.id,
      createdByName: user.name,
    });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: user.restaurantId },
      select: { name: true, phone: true, address: true },
    });

    const whatsappMessage = buildWhatsAppReminder({
      restaurantName: restaurant?.name || "Restaurant",
      restaurantAddress: restaurant?.address,
      restaurantPhone: restaurant?.phone,
      customerName: booking.customerName,
      guestCount: booking.guestCount,
      bookingDate: booking.bookingDate,
      bookingTime: booking.bookingTime,
      tableNumber: booking.tableNumber,
      specialNotes: booking.specialNotes,
    });

    const cleanPhone = booking.customerPhone.replace(/\D/g, "").slice(-10);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(
      whatsappMessage
    )}`;

    return {
      booking,
      whatsappUrl,
      whatsappMessage,
    };
  });
}

export async function PUT(req: Request) {
  return withRole(["OWNER", "MANAGER", "WAITER"], async (user) => {
    const body = updateSchema.parse(await req.json());

    if (body.markReminderSent) {
      const updated = markBookingReminderSent(body.id, user.restaurantId);
      return updated;
    }

    const updates: any = {};
    if (body.status) updates.status = body.status;
    if (body.tableId !== undefined) updates.tableId = body.tableId;
    if (body.tableNumber !== undefined) updates.tableNumber = body.tableNumber;
    if (body.guestCount !== undefined) updates.guestCount = body.guestCount;
    if (body.bookingDate !== undefined) updates.bookingDate = body.bookingDate;
    if (body.bookingTime !== undefined) updates.bookingTime = body.bookingTime;
    if (body.specialNotes !== undefined) updates.specialNotes = body.specialNotes;

    const updated = updateBooking(body.id, user.restaurantId, updates);

    // If marked SEATED and has tableId, set table to OCCUPIED
    if (body.status === "SEATED" && updated?.tableId) {
      try {
        await prisma.restaurantTable.update({
          where: { id: updated.tableId },
          data: { status: "OCCUPIED" },
        });
      } catch (e) {
        console.warn("Could not update table status to OCCUPIED:", e);
      }
    }

    return updated;
  });
}

export async function DELETE(req: Request) {
  return withRole(["OWNER", "MANAGER"], async (user) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new Error("Booking ID is required");

    const ok = deleteBooking(id, user.restaurantId);
    return { ok };
  });
}

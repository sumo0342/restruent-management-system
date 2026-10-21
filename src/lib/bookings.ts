import fs from "fs";
import path from "path";

import os from "os";

export type BookingStatus = "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED";

export type TableBooking = {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // e.g. "19:30" or "07:30 PM"
  tableId?: string | null;
  tableNumber?: string | null;
  status: BookingStatus;
  specialNotes?: string | null;
  reminderSent: boolean;
  lastReminderAt?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

function getBookingsFilePath(): string {
  // In serverless environments like Vercel, the app root is read-only.
  // Use os.tmpdir() so writes do not trigger EROFS errors.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpFile = path.join(os.tmpdir(), "table-bookings.json");
    if (!fs.existsSync(tmpFile)) {
      const defaultFile = path.join(process.cwd(), "data", "table-bookings.json");
      try {
        if (fs.existsSync(defaultFile)) {
          fs.copyFileSync(defaultFile, tmpFile);
        } else {
          fs.writeFileSync(tmpFile, "[]", "utf-8");
        }
      } catch (err) {
        console.error("Error setting up tmp bookings file:", err);
      }
    }
    return tmpFile;
  }
  return path.join(process.cwd(), "data", "table-bookings.json");
}

function ensureFileExists(filePath: string) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error initializing bookings storage:", err);
  }
}

export function readAllBookings(): TableBooking[] {
  const filePath = getBookingsFilePath();
  ensureFileExists(filePath);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Error reading bookings file:", err);
    return [];
  }
}

export function writeAllBookings(bookings: TableBooking[]): boolean {
  const filePath = getBookingsFilePath();
  ensureFileExists(filePath);
  try {
    fs.writeFileSync(filePath, JSON.stringify(bookings, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing bookings file:", err);
    return false;
  }
}

export function getRestaurantBookings(restaurantId: string, branchId?: string | null): TableBooking[] {
  const all = readAllBookings();
  return all
    .filter((b) => {
      if (b.restaurantId !== restaurantId) return false;
      if (branchId && b.branchId && b.branchId !== branchId) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by date then time ascending
      const dtA = `${a.bookingDate} ${a.bookingTime}`;
      const dtB = `${b.bookingDate} ${b.bookingTime}`;
      return dtA.localeCompare(dtB);
    });
}

export function createBooking(data: {
  restaurantId: string;
  branchId?: string | null;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  bookingDate: string;
  bookingTime: string;
  tableId?: string | null;
  tableNumber?: string | null;
  specialNotes?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
}): TableBooking {
  const all = readAllBookings();
  const cleanPhone = data.customerPhone.replace(/\D/g, "").slice(-10);

  const newBooking: TableBooking = {
    id: `book_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    restaurantId: data.restaurantId,
    branchId: data.branchId || null,
    customerName: data.customerName.trim(),
    customerPhone: cleanPhone,
    guestCount: Number(data.guestCount) || 2,
    bookingDate: data.bookingDate,
    bookingTime: data.bookingTime,
    tableId: data.tableId || null,
    tableNumber: data.tableNumber || null,
    status: "CONFIRMED",
    specialNotes: data.specialNotes?.trim() || null,
    reminderSent: false,
    lastReminderAt: null,
    createdById: data.createdById || null,
    createdByName: data.createdByName || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  all.push(newBooking);
  writeAllBookings(all);
  return newBooking;
}

export function updateBooking(
  id: string,
  restaurantId: string,
  updates: Partial<Omit<TableBooking, "id" | "restaurantId" | "createdAt">>
): TableBooking | null {
  const all = readAllBookings();
  const index = all.findIndex((b) => b.id === id && b.restaurantId === restaurantId);
  if (index === -1) return null;

  const existing = all[index];
  const updated: TableBooking = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  writeAllBookings(all);
  return updated;
}

export function markBookingReminderSent(id: string, restaurantId: string): TableBooking | null {
  return updateBooking(id, restaurantId, {
    reminderSent: true,
    lastReminderAt: new Date().toISOString(),
  });
}

export function deleteBooking(id: string, restaurantId: string): boolean {
  const all = readAllBookings();
  const filtered = all.filter((b) => !(b.id === id && b.restaurantId === restaurantId));
  if (filtered.length === all.length) return false;
  writeAllBookings(filtered);
  return true;
}

export function buildWhatsAppReminder({
  restaurantName,
  restaurantAddress,
  restaurantPhone,
  customerName,
  guestCount,
  bookingDate,
  bookingTime,
  tableNumber,
  specialNotes,
}: {
  restaurantName: string;
  restaurantAddress?: string | null;
  restaurantPhone?: string | null;
  customerName: string;
  guestCount: number;
  bookingDate: string;
  bookingTime: string;
  tableNumber?: string | null;
  specialNotes?: string | null;
}) {
  return `🍽️ *TABLE RESERVATION CONFIRMED & REMINDER*
*${restaurantName}*

Dear *${customerName}*,
We are pleased to confirm your table reservation:

📅 *Date:* ${bookingDate}
⏰ *Time:* ${bookingTime}
👥 *Guests:* ${guestCount} Person(s)
🪑 *Reserved Table:* ${tableNumber ? `Table #${tableNumber}` : "Reserved for you on arrival"}
${specialNotes ? `📝 *Special Request:* ${specialNotes}\n` : ""}${restaurantAddress ? `📍 *Address:* ${restaurantAddress}\n` : ""}${restaurantPhone ? `📞 *Contact:* ${restaurantPhone}\n` : ""}
We look forward to serving you! Please arrive 10 minutes prior to your reserved slot.
Reply *CONFIRM* to re-confirm or *CANCEL* if your plans change. 🙏`;
}

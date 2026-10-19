import fs from "fs";
import path from "path";

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

const DATA_DIR = path.join(process.cwd(), "data");
const BOOKINGS_FILE = path.join(DATA_DIR, "table-bookings.json");

function ensureFileExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BOOKINGS_FILE)) {
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([], null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error initializing bookings storage:", err);
  }
}

export function readAllBookings(): TableBooking[] {
  ensureFileExists();
  try {
    const raw = fs.readFileSync(BOOKINGS_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("Error reading bookings file:", err);
    return [];
  }
}

export function writeAllBookings(bookings: TableBooking[]): boolean {
  ensureFileExists();
  try {
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2), "utf-8");
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

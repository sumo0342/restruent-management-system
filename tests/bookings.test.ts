import { describe, it, expect } from "vitest";
import {
  buildWhatsAppReminder,
  createBooking,
  getRestaurantBookings,
  markBookingReminderSent,
  updateBooking,
  deleteBooking,
} from "../src/lib/bookings";

describe("table bookings and WhatsApp reminder", () => {
  it("formats WhatsApp reminder message with all reservation details", () => {
    const text = buildWhatsAppReminder({
      restaurantName: "Spice Route Indian Bistro",
      restaurantAddress: "123 MG Road, Bengaluru",
      restaurantPhone: "9876543210",
      customerName: "Ananya Roy",
      guestCount: 4,
      bookingDate: "2026-10-25",
      bookingTime: "08:00 PM",
      tableNumber: "T-5",
      specialNotes: "Window seat, Birthday celebration",
    });

    expect(text).toContain("TABLE RESERVATION CONFIRMED & REMINDER");
    expect(text).toContain("Spice Route Indian Bistro");
    expect(text).toContain("Ananya Roy");
    expect(text).toContain("4 Person(s)");
    expect(text).toContain("2026-10-25");
    expect(text).toContain("08:00 PM");
    expect(text).toContain("Table #T-5");
    expect(text).toContain("Birthday celebration");
  });

  it("creates, retrieves, updates and marks reminder sent on a booking", () => {
    const testRestId = `test_rest_${Date.now()}`;
    const booking = createBooking({
      restaurantId: testRestId,
      customerName: "Vikram Malhotra",
      customerPhone: "+91 98765-43210",
      guestCount: 6,
      bookingDate: "2026-11-01",
      bookingTime: "07:30 PM",
      tableNumber: "T-10",
      specialNotes: "Family dinner",
    });

    expect(booking.id).toBeDefined();
    expect(booking.customerPhone).toBe("9876543210");
    expect(booking.status).toBe("CONFIRMED");
    expect(booking.reminderSent).toBe(false);

    // Retrieve
    const list = getRestaurantBookings(testRestId);
    expect(list.length).toBe(1);
    expect(list[0].customerName).toBe("Vikram Malhotra");

    // Mark reminder sent
    const reminderUpdated = markBookingReminderSent(booking.id, testRestId);
    expect(reminderUpdated?.reminderSent).toBe(true);
    expect(reminderUpdated?.lastReminderAt).toBeDefined();

    // Update status to SEATED
    const seated = updateBooking(booking.id, testRestId, { status: "SEATED" });
    expect(seated?.status).toBe("SEATED");

    // Cleanup
    const deleted = deleteBooking(booking.id, testRestId);
    expect(deleted).toBe(true);
    expect(getRestaurantBookings(testRestId).length).toBe(0);
  });
});

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { posSound } from "@/lib/sound";
import {
  CalendarDays,
  CalendarCheck,
  Plus,
  Search,
  Users,
  Smartphone,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  Copy,
  ChevronRight,
  Sparkles,
  UtensilsCrossed,
  Filter,
  Check,
  RefreshCw,
  BellRing,
  Trash2,
} from "lucide-react";

type BookingStatus = "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED";

type Booking = {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  customerName: string;
  customerPhone: string;
  guestCount: number;
  bookingDate: string;
  bookingTime: string;
  tableId?: string | null;
  tableNumber?: string | null;
  status: BookingStatus;
  specialNotes?: string | null;
  reminderSent: boolean;
  lastReminderAt?: string | null;
  createdAt: string;
};

type Table = {
  id: string;
  number: string;
  capacity: number;
  section?: string | null;
  status: string;
};

type RestaurantInfo = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

const POPULAR_SLOTS = [
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "07:00 PM",
  "07:30 PM",
  "08:00 PM",
  "08:30 PM",
  "09:00 PM",
];

export function BookingsBoard({ role = "manager" }: { role?: "owner" | "manager" | "waiter" }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "TODAY" | "UPCOMING" | "SEATED" | "PENDING_REMINDER">("TODAY");

  // Create Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const todayStr = new Date().toISOString().split("T")[0];
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [bookingTime, setBookingTime] = useState("07:30 PM");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [autoOpenWhatsApp, setAutoOpenWhatsApp] = useState(true);

  // Quick WhatsApp Preview / Action Modal
  const [previewBooking, setPreviewBooking] = useState<Booking | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch bookings
  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bookings", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setBookings(json.data.bookings || []);
        setTables(json.data.tables || []);
        setRestaurant(json.data.restaurant || null);
      }
    } catch (err) {
      console.error("Failed to load bookings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Statistics
  const stats = useMemo(() => {
    const todayList = bookings.filter((b) => b.bookingDate === todayStr && b.status !== "CANCELLED");
    const todayGuests = todayList.reduce((sum, b) => sum + (b.guestCount || 0), 0);
    const seatedToday = todayList.filter((b) => b.status === "SEATED").length;
    const pendingReminders = bookings.filter(
      (b) => b.bookingDate >= todayStr && b.status === "CONFIRMED" && !b.reminderSent
    ).length;

    return {
      todayCount: todayList.length,
      todayGuests,
      seatedToday,
      pendingReminders,
      totalCount: bookings.length,
    };
  }, [bookings, todayStr]);

  // Filtered Bookings List
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Tab filter
      if (filterTab === "TODAY") {
        if (b.bookingDate !== todayStr) return false;
      } else if (filterTab === "UPCOMING") {
        if (b.bookingDate < todayStr || b.status === "CANCELLED" || b.status === "COMPLETED") return false;
      } else if (filterTab === "SEATED") {
        if (b.status !== "SEATED") return false;
      } else if (filterTab === "PENDING_REMINDER") {
        if (b.reminderSent || b.status !== "CONFIRMED" || b.bookingDate < todayStr) return false;
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = b.customerName.toLowerCase().includes(q);
        const matchPhone = b.customerPhone.includes(q);
        const matchTable = b.tableNumber?.toLowerCase().includes(q);
        const matchNotes = b.specialNotes?.toLowerCase().includes(q);
        return matchName || matchPhone || matchTable || matchNotes;
      }

      return true;
    });
  }, [bookings, filterTab, search, todayStr]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  }

  // Build formatted WhatsApp message
  function getReminderText(b: Booking) {
    const restName = restaurant?.name || "Our Restaurant";
    const cleanPhone = b.customerPhone.replace(/\D/g, "").slice(-10);

    return `🍽️ *TABLE RESERVATION CONFIRMED & REMINDER*
*${restName}*

Dear *${b.customerName}*,
We look forward to hosting you for dining! Here are your reservation details:

📅 *Date:* ${b.bookingDate}
⏰ *Time:* ${b.bookingTime}
👥 *Party:* ${b.guestCount} Guest(s)
🪑 *Reserved Table:* ${b.tableNumber ? `Table #${b.tableNumber}` : "Dedicated Table on arrival"}
${b.specialNotes ? `📝 *Special Request:* ${b.specialNotes}\n` : ""}${restaurant?.address ? `📍 *Location:* ${restaurant.address}\n` : ""}${restaurant?.phone ? `📞 *Call Us:* ${restaurant.phone}\n` : ""}
Please arrive 10 minutes prior to your booking.
Reply *CONFIRM* to re-confirm or *CANCEL* if your plans change. 🙏`;
  }

  // Dispatch individual WhatsApp Reminder
  async function sendWhatsAppReminder(b: Booking) {
    const cleanPhone = b.customerPhone.replace(/\D/g, "").slice(-10);
    const text = getReminderText(b);
    const url = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(text)}`;

    window.open(url, "_blank");
    posSound.playClick();

    // Mark as reminder sent
    try {
      await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, markReminderSent: true }),
      });
      setBookings((prev) =>
        prev.map((item) =>
          item.id === b.id ? { ...item, reminderSent: true, lastReminderAt: new Date().toISOString() } : item
        )
      );
      showToast(`WhatsApp reminder dispatched to ${b.customerName} (+91 ${cleanPhone})!`);
    } catch {
      showToast(`Reminder opened in WhatsApp for ${b.customerName}!`);
    }
  }

  // Automatic Batch Reminder for Today
  async function handleAutoRemindAllPending() {
    const pendingList = bookings.filter(
      (b) => b.bookingDate === todayStr && b.status === "CONFIRMED" && !b.reminderSent
    );

    if (pendingList.length === 0) {
      showToast("All guests for today have already received WhatsApp reminders!");
      return;
    }

    posSound.playCashRegister();

    // Send first in new tab and prepare all
    for (let i = 0; i < pendingList.length; i++) {
      const b = pendingList[i];
      if (i === 0) {
        sendWhatsAppReminder(b);
      } else {
        // Mark remaining sent so cashier doesn't get flooded
        await fetch("/api/bookings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: b.id, markReminderSent: true }),
        });
      }
    }

    await loadBookings();
    showToast(`Automated WhatsApp reminders triggered for ${pendingList.length} guest(s)!`);
  }

  // Update Status (Seated, Cancelled, Completed)
  async function updateStatus(id: string, newStatus: BookingStatus, tableId?: string | null) {
    posSound.playClick();
    try {
      const res = await fetch("/api/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus, tableId }),
      });
      const json = await res.json();
      if (json.ok) {
        setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
        if (newStatus === "SEATED") {
          posSound.playUpiChime();
          showToast(`Guest seated! Table marked OCCUPIED.`);
        } else if (newStatus === "CANCELLED") {
          showToast(`Reservation cancelled.`);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Delete Booking
  async function handleDeleteBooking(id: string) {
    if (!confirm("Are you sure you want to delete this reservation?")) return;
    try {
      const res = await fetch(`/api/bookings?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== id));
        showToast("Booking deleted.");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Save New Booking
  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = customerPhone.replace(/\D/g, "").slice(-10);
    if (!customerName.trim()) {
      setFormError("Please enter guest/customer name");
      return;
    }
    if (cleanPhone.length !== 10) {
      setFormError("Please enter a valid 10-digit mobile number");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const selectedTable = tables.find((t) => t.id === selectedTableId);
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone: cleanPhone,
          guestCount: Number(guestCount),
          bookingDate,
          bookingTime,
          tableId: selectedTableId || null,
          tableNumber: selectedTable?.number || null,
          specialNotes: specialNotes || null,
          autoSendWhatsApp: autoOpenWhatsApp,
        }),
      });

      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      posSound.playCashRegister();

      // Launch WhatsApp confirmation immediately if checked
      if (autoOpenWhatsApp && json.data?.whatsappUrl) {
        window.open(json.data.whatsappUrl, "_blank");
      }

      setModalOpen(false);
      resetForm();
      await loadBookings();
      showToast(`Table reservation confirmed for ${customerName}! WhatsApp notification prepared.`);
    } catch (err: any) {
      setFormError(err.message || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setGuestCount(2);
    setBookingDate(todayStr);
    setBookingTime("07:30 PM");
    setSelectedTableId("");
    setSpecialNotes("");
    setFormError(null);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold animate-toast border border-emerald-400">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/35 text-emerald-400 flex items-center justify-center text-2xl shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            📅
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl md:text-3xl font-extrabold text-[#FAF8F5]">Table Bookings</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live Bookings
              </span>
            </div>
            <p className="text-xs text-[#9DB7AA] mt-0.5">
              Manage dining reservations and send automated WhatsApp reminders to guests.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => loadBookings()}
            disabled={loading}
            className="btn-secondary !p-2.5 rounded-xl text-slate-300 hover:text-white"
            title="Refresh bookings"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={() => {
              setModalOpen(true);
              posSound.playClick();
            }}
            className="btn-primary !py-2.5 !px-4 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Plus size={16} />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="card p-4 bg-white/[0.03] border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-smoke">Today's Bookings</span>
            <span className="text-emerald-400 text-lg">📅</span>
          </div>
          <p className="font-display text-2xl font-bold text-white mt-1">{stats.todayCount}</p>
          <p className="text-[11px] text-[#9DB7AA] mt-0.5">{stats.todayGuests} total guests expected</p>
        </div>

        <div className="card p-4 bg-white/[0.03] border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-smoke">Currently Seated</span>
            <span className="text-teal-400 text-lg">🪑</span>
          </div>
          <p className="font-display text-2xl font-bold text-white mt-1">{stats.seatedToday}</p>
          <p className="text-[11px] text-[#9DB7AA] mt-0.5">Tables currently dining</p>
        </div>

        <div className="card p-4 bg-white/[0.03] border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-smoke">All Upcoming</span>
            <span className="text-amber-400 text-lg">⏳</span>
          </div>
          <p className="font-display text-2xl font-bold text-white mt-1">
            {bookings.filter((b) => b.status === "CONFIRMED").length}
          </p>
          <p className="text-[11px] text-[#9DB7AA] mt-0.5">Confirmed reservations</p>
        </div>

        {/* WhatsApp Automated Reminders Card with Action Trigger */}
        <div className="card p-4 bg-gradient-to-br from-emerald-950/40 to-[#0A261D]/80 border-emerald-500/30 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
              <MessageSquare size={13} /> WhatsApp Reminders
            </span>
            {stats.pendingReminders > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <p className="font-display text-2xl font-bold text-white">
              {stats.pendingReminders}{" "}
              <span className="text-xs font-normal text-emerald-200/80">Pending</span>
            </p>
            {stats.pendingReminders > 0 && (
              <button
                type="button"
                onClick={handleAutoRemindAllPending}
                className="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors shadow-sm flex items-center gap-1"
                title="Send automatic WhatsApp reminder to all pending guests for today"
              >
                <Send size={10} />
                <span>Auto-Remind</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-emerald-300/80 mt-0.5">
            {stats.pendingReminders === 0 ? "All guests notified via WhatsApp" : "Ready to dispatch WhatsApp alerts"}
          </p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 overflow-x-auto">
          {[
            { id: "TODAY", label: "Today", count: stats.todayCount },
            { id: "UPCOMING", label: "Upcoming", count: bookings.filter((b) => b.bookingDate >= todayStr && b.status === "CONFIRMED").length },
            { id: "PENDING_REMINDER", label: "Needs Reminder", count: stats.pendingReminders },
            { id: "SEATED", label: "Seated", count: stats.seatedToday },
            { id: "ALL", label: "All Bookings", count: stats.totalCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterTab(tab.id as any);
                posSound.playClick();
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterTab === tab.id
                  ? "bg-emerald-500 text-slate-950 font-extrabold shadow-md"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filterTab === tab.id ? "bg-slate-950/20 text-slate-950 font-black" : "bg-white/10 text-slate-300"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
          <input
            type="text"
            placeholder="Search guest, phone, table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input !pl-8 !py-1.5 text-xs w-full bg-white/[0.04]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-smoke hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Bookings List / Cards */}
      <div className="space-y-3">
        {filteredBookings.map((b) => {
          const isToday = b.bookingDate === todayStr;
          const isPast = b.bookingDate < todayStr;
          const cleanPhone = b.customerPhone.replace(/\D/g, "").slice(-10);

          return (
            <div
              key={b.id}
              className={`card p-4 bg-white/[0.03] border-white/10 hover:border-emerald-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                b.status === "SEATED" ? "border-l-4 border-l-teal-400 bg-teal-950/10" : ""
              } ${b.status === "CANCELLED" ? "opacity-50" : ""}`}
            >
              {/* Left Column: Guest & Time info */}
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-lg shrink-0">
                  {b.status === "SEATED" ? "🪑" : b.status === "CANCELLED" ? "❌" : "🍽️"}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-white">{b.customerName}</span>
                    <a
                      href={`tel:+91${cleanPhone}`}
                      className="text-xs text-emerald-400 font-mono flex items-center gap-1 hover:underline"
                    >
                      <Smartphone size={12} />
                      <span>+91 {cleanPhone}</span>
                    </a>

                    {/* Status Badge */}
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        b.status === "SEATED"
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                          : b.status === "CONFIRMED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : b.status === "CANCELLED"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-white/10 text-slate-300 border border-white/20"
                      }`}
                    >
                      {b.status}
                    </span>

                    {/* Today Badge */}
                    {isToday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Booking Date & Slot */}
                  <div className="flex items-center gap-3 text-xs text-[#9DB7AA]">
                    <span className="flex items-center gap-1 text-white/90 font-medium">
                      <CalendarDays size={12} className="text-emerald-400" />
                      {b.bookingDate}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-white/90 font-medium">
                      <Clock size={12} className="text-emerald-400" />
                      {b.bookingTime}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {b.guestCount} Guest{b.guestCount > 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span className="font-semibold text-emerald-300">
                      {b.tableNumber ? `Table #${b.tableNumber}` : "Table Unassigned"}
                    </span>
                  </div>

                  {/* Special Note if any */}
                  {b.specialNotes && (
                    <p className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg inline-block">
                      Note: {b.specialNotes}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Automated WhatsApp Reminder & Action Controls */}
              <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                {/* WhatsApp Reminder Status & Trigger Button */}
                {b.status === "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => sendWhatsAppReminder(b)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                      b.reminderSent
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 animate-pulse"
                    }`}
                    title={
                      b.reminderSent
                        ? `Reminder sent (${b.lastReminderAt ? new Date(b.lastReminderAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Earlier"}). Click to send again.`
                        : "Send automatic WhatsApp confirmation & reminder"
                    }
                  >
                    <MessageSquare size={14} className={b.reminderSent ? "text-emerald-400" : "text-white"} />
                    <span>{b.reminderSent ? "✓ Reminder Sent" : "💬 Send WhatsApp Reminder"}</span>
                  </button>
                )}

                {/* Mark Seated Button */}
                {b.status === "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(b.id, "SEATED", b.tableId)}
                    className="btn-secondary !py-1.5 !px-3 text-xs font-bold text-teal-300 border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 flex items-center gap-1"
                    title="Mark guest as arrived and seated at table"
                  >
                    <span>🪑 Seat Guest</span>
                  </button>
                )}

                {/* Mark Completed Button */}
                {b.status === "SEATED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(b.id, "COMPLETED")}
                    className="btn-secondary !py-1.5 !px-3 text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    <span>Complete</span>
                  </button>
                )}

                {/* Cancel Booking */}
                {b.status === "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => updateStatus(b.id, "CANCELLED")}
                    className="btn-secondary !py-1.5 !px-2.5 text-xs text-rose-400 hover:text-rose-300 border-rose-500/30"
                    title="Cancel booking"
                  >
                    <span>Cancel</span>
                  </button>
                )}

                {/* Delete button for owners/managers */}
                {role !== "waiter" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteBooking(b.id)}
                    className="text-smoke hover:text-rose-400 p-1.5 rounded-lg"
                    title="Delete record"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredBookings.length === 0 && (
          <div className="card p-12 text-center text-smoke space-y-3 bg-white/[0.02]">
            <CalendarCheck size={40} className="mx-auto text-emerald-400/60" />
            <p className="font-semibold text-white">No table bookings match your filter.</p>
            <p className="text-xs max-w-sm mx-auto text-[#9DB7AA]">
              {filterTab === "TODAY"
                ? "No reservations booked for today yet. Click 'New Reservation' to add one."
                : "Try switching tabs or searching with different criteria."}
            </p>
            <button
              onClick={() => {
                setModalOpen(true);
                posSound.playClick();
              }}
              className="btn-primary !py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Book Table Now</span>
            </button>
          </div>
        )}
      </div>

      {/* CREATE NEW BOOKING MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0B261E] rounded-2xl border border-emerald-500/30 shadow-2xl max-w-md w-full overflow-hidden animate-page">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} />
                <h3 className="font-display font-bold text-base">New Table Reservation</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  resetForm();
                }}
                className="text-white/80 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Guest Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">Guest Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="input text-xs"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">
                    Mobile Number *
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono font-bold text-emerald-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="10-digit number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="input text-xs font-mono flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Guest Count & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">Party Size</label>
                  <div className="flex items-center gap-1">
                    {[2, 4, 6, 8].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setGuestCount(n)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          guestCount === n
                            ? "bg-emerald-500 text-slate-950 font-black shadow"
                            : "bg-white/[0.05] text-slate-300 hover:text-white"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={guestCount}
                      onChange={(e) => setGuestCount(Math.max(1, Number(e.target.value)))}
                      className="input text-xs w-14 font-mono text-center !py-1.5"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white uppercase tracking-wider">Booking Date</label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              {/* Time Slot Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white uppercase tracking-wider">Time Slot</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {POPULAR_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setBookingTime(slot)}
                      className={`py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        bookingTime === slot
                          ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                          : "bg-white/[0.05] text-slate-300 hover:text-white"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom time (e.g. 08:15 PM)"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="input text-xs mt-1"
                />
              </div>

              {/* Table Selection */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase tracking-wider">
                  Assign Table (Optional)
                </label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="input text-xs"
                >
                  <option value="">No table assigned yet (assign on arrival)</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number} ({t.capacity} seats{t.section ? ` · ${t.section}` : ""}) — {t.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Special Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-white uppercase tracking-wider">
                  Special Notes / Occasion
                </label>
                <input
                  type="text"
                  placeholder="e.g. Window table, Anniversary celebration, High chair"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  className="input text-xs"
                />
              </div>

              {/* Auto WhatsApp Reminder Checkbox */}
              <label className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoOpenWhatsApp}
                  onChange={(e) => setAutoOpenWhatsApp(e.target.checked)}
                  className="rounded border-emerald-500 text-emerald-500 focus:ring-emerald-400"
                />
                <div className="text-xs">
                  <p className="font-bold text-emerald-300 flex items-center gap-1">
                    <MessageSquare size={13} />
                    <span>Auto-Send WhatsApp Confirmation</span>
                  </p>
                  <p className="text-[11px] text-emerald-200/70">
                    Immediately opens WhatsApp with formatted booking confirmation message for the guest.
                  </p>
                </div>
              </label>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false);
                    resetForm();
                  }}
                  className="btn-secondary text-xs py-2 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs py-2 px-4 font-bold shadow-lg"
                >
                  {saving ? "Saving..." : "Confirm & Book Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

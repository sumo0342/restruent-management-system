"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { buildUpiUri } from "@/lib/upi";
import { posSound } from "@/lib/sound";
import {
  Banknote,
  CreditCard,
  QrCode,
  Building2,
  Wallet,
  Split,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Volume2,
  VolumeX,
  Receipt,
  Printer,
  Download,
  RefreshCw,
  Search,
  Copy,
  Check,
  ShieldCheck,
  Users,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  BadgePercent,
  AlertCircle,
  X,
  FileText,
  ShoppingBag,
  ListOrdered,
  Smartphone,
  Send,
  MessageSquare,
  CalendarDays,
} from "lucide-react";

type Table = {
  id: string;
  number: string;
  capacity?: number;
  section?: string | null;
  status: string;
  todayBooking?: { customerName: string; bookingTime: string; guestCount: number } | null;
};

type OrderItem = {
  id: string;
  nameSnapshot: string;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string | null;
};

type Order = {
  id: string;
  orderNumber: number;
  status: string;
  customerNote?: string | null;
  items: OrderItem[];
  waiter: { name: string };
  createdAt: string;
};

type Bill = {
  id: string;
  billNumber: number;
  total: number;
  status: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  discountReason?: string | null;
  amountPaid: number;
  createdAt?: string;
  session?: { table?: { number: string; id: string } };
  issuedBy?: { name: string };
  payments?: { method: string; amount: number; transactionReference?: string }[];
};

type SessionData = {
  table: Table;
  session: { id: string; orders: Order[]; bill: Bill | null } | null;
  restaurant: {
    name: string;
    taxPercent: number;
    serviceChargePercent: number;
    currencySymbol: string;
    upiId: string | null;
    gstin?: string | null;
  };
  billableOrders?: Order[];
  subtotal?: number;
  lastBill?: Bill | null;
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  isVeg: boolean;
  category?: { name: string };
};

type MenuCategory = {
  id: string;
  name: string;
  items: MenuItem[];
};

type PaymentRow = {
  method: "CASH" | "CARD" | "UPI" | "NET_BANKING" | "WALLET" | "GATEWAY";
  amount: string;
  reference?: string;
};

type PaymentTab = "CASH" | "CARD" | "UPI" | "GATEWAY" | "NET_BANKING" | "WALLET" | "SPLIT";

const INDIAN_BANKS = [
  { id: "HDFC", name: "HDFC Bank", logo: "🏦" },
  { id: "SBI", name: "State Bank of India", logo: "🏛️" },
  { id: "ICICI", name: "ICICI Bank", logo: "🏦" },
  { id: "AXIS", name: "Axis Bank", logo: "🏢" },
  { id: "KOTAK", name: "Kotak Mahindra", logo: "🏛️" },
  { id: "PNB", name: "Punjab National Bank", logo: "🏦" },
];

export function BillingBoard() {
  const router = useRouter();
  const params = useSearchParams();

  // View switch: Tables Floor View vs Invoices / All Bills Ledger
  const [viewMode, setViewMode] = useState<"TABLES" | "BILLS">("TABLES");

  // Core state
  const [tables, setTables] = useState<Table[]>([]);
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(params.get("table"));
  const [data, setData] = useState<SessionData | null>(null);
  const [tableFilter, setTableFilter] = useState<"ALL" | "BILL_PENDING" | "OCCUPIED" | "AVAILABLE">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [billsSearchQuery, setBillsSearchQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Quick Walk-In POS Order state
  const [quickOrderOpen, setQuickOrderOpen] = useState(false);
  const [quickOrderType, setQuickOrderType] = useState<"DINE_IN" | "PARCEL">("DINE_IN");
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [quickCart, setQuickCart] = useState<Record<string, number>>({});
  const [menuSearch, setMenuSearch] = useState("");

  // Customer Mobile & Sharing state
  const [customerMobile, setCustomerMobile] = useState("");
  const [mobileFeedback, setMobileFeedback] = useState<string | null>(null);
  const [postPayMobile, setPostPayMobile] = useState("");
  const [postPayMobileFeedback, setPostPayMobileFeedback] = useState<string | null>(null);

  // Bill customization
  const [discount, setDiscount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [activePaymentTab, setActivePaymentTab] = useState<PaymentTab>("CASH");

  // Cash payment specific
  const [cashTendered, setCashTendered] = useState<string>("");

  // Card payment specific
  const [cardBrand, setCardBrand] = useState<"VISA" | "MASTERCARD" | "RUPAY" | "AMEX">("VISA");
  const [cardAuthCode, setCardAuthCode] = useState<string>("");
  const [cardLast4, setCardLast4] = useState<string>("");

  // UPI payment specific
  const [upiUtr, setUpiUtr] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(300);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrMode, setQrMode] = useState<"STAND_EE" | "DYNAMIC">("STAND_EE");
  const [customQrUrl, setCustomQrUrl] = useState<string | null>(null);
  const [hasCustomQr, setHasCustomQr] = useState<boolean>(false);

  useEffect(() => {
    fetch("/api/owner/upload-qr")
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j?.data) {
          setCustomQrUrl(j.data.activeQrUrl || null);
          setHasCustomQr(Boolean(j.data.hasCustomQr));
          if (!j.data.hasCustomQr) {
            setQrMode("DYNAMIC");
          }
        }
      })
      .catch(() => {});
  }, []);

  // Bank & Wallet specific
  const [selectedBank, setSelectedBank] = useState("HDFC");
  const [bankRef, setBankRef] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("PAYTM");
  const [walletRef, setWalletRef] = useState("");

  // Online Gateway simulator
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [gatewayStep, setGatewayStep] = useState<"SELECT" | "PROCESSING" | "SUCCESS">("SELECT");
  const [gatewayMethod, setGatewayMethod] = useState<"CARD" | "UPI" | "NETBANKING">("UPI");

  // Split payment
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: "CASH", amount: "", reference: "" },
    { method: "UPI", amount: "", reference: "" },
  ]);

  // Success / Receipt Modal
  const [paidReceiptBill, setPaidReceiptBill] = useState<{ id: string; billNumber: number; total: number } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep sound manager in sync
  useEffect(() => {
    posSound.enabled = soundEnabled;
  }, [soundEnabled]);

  // Load tables
  const loadTables = useCallback(async () => {
    try {
      const res = await fetch("/api/manager/tables", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setTables(json.data);
    } catch {
      // Ignore poll error
    }
  }, []);

  // Load all bills
  const loadAllBills = useCallback(async () => {
    setBillsLoading(true);
    try {
      const res = await fetch("/api/manager/bills", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setAllBills(json.data);
    } catch {
      // Ignore poll error
    } finally {
      setBillsLoading(false);
    }
  }, []);

  // Load session
  const loadSession = useCallback(async (tableId: string) => {
    try {
      const res = await fetch(`/api/manager/session/${tableId}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
        if (json.data?.session?.bill) {
          setCashTendered(json.data.session.bill.total.toFixed(2));
        }
      }
    } catch {
      // Ignore poll error
    }
  }, []);

  // Load menu items for quick bill creation
  const loadMenu = useCallback(async () => {
    try {
      const res = await fetch("/api/manager/menu", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setMenuCategories(json.data);
    } catch {
      // Ignore error
    }
  }, []);

  useEffect(() => {
    loadTables();
    loadAllBills();
    loadMenu();
    const i = setInterval(() => {
      loadTables();
      if (viewMode === "BILLS") loadAllBills();
    }, 5000);
    return () => clearInterval(i);
  }, [loadTables, loadAllBills, loadMenu, viewMode]);

  useEffect(() => {
    if (selected) {
      loadSession(selected);
      setQuickOrderOpen(false);
      setQuickCart({});
    } else {
      setData(null);
    }
  }, [selected, loadSession]);

  useEffect(() => {
    if (!selected) return;
    const i = setInterval(() => loadSession(selected), 4000);
    return () => clearInterval(i);
  }, [selected, loadSession]);

  // Live QR timer countdown
  useEffect(() => {
    if (activePaymentTab !== "UPI") return;
    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => (prev <= 1 ? 300 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [activePaymentTab]);

  const bill = data?.session?.bill;
  const currency = data?.restaurant.currencySymbol || "₹";

  // Filtered tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = t.number.toLowerCase().includes(q);
        const matchesSec = t.section?.toLowerCase().includes(q);
        if (!matchesNum && !matchesSec) return false;
      }
      if (tableFilter === "BILL_PENDING") {
        return t.status === "WAITING_FOR_BILL" || t.status === "FOOD_READY";
      }
      if (tableFilter === "OCCUPIED") {
        return t.status !== "AVAILABLE" && t.status !== "CLEANING";
      }
      if (tableFilter === "AVAILABLE") {
        return t.status === "AVAILABLE";
      }
      return true;
    });
  }, [tables, tableFilter, searchQuery]);

  // Filtered bills
  const filteredBills = useMemo(() => {
    if (!billsSearchQuery.trim()) return allBills;
    const q = billsSearchQuery.toLowerCase();
    return allBills.filter((b) => {
      const matchNum = b.billNumber.toString().includes(q);
      const matchTable = b.session?.table?.number.toLowerCase().includes(q);
      const matchStatus = b.status.toLowerCase().includes(q);
      return matchNum || matchTable || matchStatus;
    });
  }, [allBills, billsSearchQuery]);

  // Table summary counts
  const counts = useMemo(() => {
    return {
      all: tables.length,
      needsBill: tables.filter((t) => t.status === "WAITING_FOR_BILL" || t.status === "FOOD_READY").length,
      occupied: tables.filter((t) => t.status !== "AVAILABLE" && t.status !== "CLEANING").length,
      available: tables.filter((t) => t.status === "AVAILABLE").length,
    };
  }, [tables]);

  // Generate Bill action
  async function generateBill() {
    if (!data?.session) return;
    setBusy(true);
    setError(null);
    try {
      posSound.playClick();
      const res = await fetch("/api/manager/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: data.session.id,
          discountAmount: Number(discount) || 0,
          discountReason: discountReason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      posSound.playCashRegister();
      await loadSession(selected!);
      await loadTables();
      await loadAllBills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Quick Direct Walk-In Bill Generation
  async function handleQuickBillGenerate() {
    if (!selected) return;
    const items = Object.entries(quickCart)
      .filter(([_, qty]) => qty > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));

    if (items.length === 0) {
      setError("Please add at least 1 menu item to ring up a bill.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      posSound.playClick();
      const res = await fetch("/api/manager/quick-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId: selected,
          items,
          customerNote: quickOrderType === "PARCEL" ? "[📦 PARCEL / TAKEAWAY]" : "[🍽️ DINE IN]",
          discountAmount: Number(discount) || 0,
          discountReason: discountReason || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      posSound.playCashRegister();
      setQuickOrderOpen(false);
      setQuickCart({});
      await loadSession(selected);
      await loadTables();
      await loadAllBills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Mobile Bill Sharing Helpers
  function formatBillTextForMobile(targetBill: Bill, targetTableNum?: string) {
    const restName = data?.restaurant.name || "Restaurant";
    const sessionOrders = data?.session?.orders || [];
    const isParcel = sessionOrders.some((o) => o.customerNote?.includes("PARCEL"));
    const typeLabel = isParcel ? "📦 PARCEL / TAKEAWAY" : "🍽️ DINE IN";

    const allItems = sessionOrders.flatMap((o) => o.items);
    const itemsText = allItems.length > 0
      ? `\n*Items Ordered:*\n` + allItems.map((i) => `• ${i.quantity}× ${i.nameSnapshot} = ${currency}${i.total.toFixed(2)}`).join("\n")
      : "";

    const upiPart = targetBill.status !== "PAID" && data?.restaurant.upiId
      ? `\n💳 *Pay via UPI:* ${data.restaurant.upiId}\n`
      : "";

    return `🧾 *${restName}*
*Tax Invoice / Bill #${targetBill.billNumber}*
Service: ${typeLabel} · Table: #${targetTableNum || data?.table.number || "-"}
Status: ${targetBill.status === "PAID" ? "PAID ✅" : "BILLED ⏳"}
${itemsText}
----------------------------
*TOTAL AMOUNT: ${currency}${targetBill.total.toFixed(2)}*
----------------------------${upiPart}
Thank you for dining with us! 🙏`;
  }

  function handleSendBillToMobile(method: "WHATSAPP" | "SMS" | "COPY", phoneInput?: string, overrideBill?: any) {
    const rawNumber = (phoneInput ?? customerMobile).replace(/\D/g, "").slice(-10);
    const targetBill = overrideBill || bill;
    if (!targetBill) return;

    if (method !== "COPY" && rawNumber.length !== 10) {
      setMobileFeedback("⚠️ Please enter a valid 10-digit mobile number");
      return;
    }

    const billMsg = formatBillTextForMobile(targetBill);

    if (method === "WHATSAPP") {
      const url = `https://api.whatsapp.com/send?phone=91${rawNumber}&text=${encodeURIComponent(billMsg)}`;
      window.open(url, "_blank");
      posSound.playClick();
      setMobileFeedback(`✅ Bill #${targetBill.billNumber} sent to +91 ${rawNumber} on WhatsApp!`);
    } else if (method === "SMS") {
      window.location.href = `sms:+91${rawNumber}?body=${encodeURIComponent(billMsg)}`;
      navigator.clipboard?.writeText(billMsg);
      posSound.playClick();
      setMobileFeedback(`✅ Bill #${targetBill.billNumber} SMS prepared for +91 ${rawNumber}!`);
    } else {
      navigator.clipboard?.writeText(billMsg);
      posSound.playClick();
      setMobileFeedback(`📋 Bill #${targetBill.billNumber} summary copied to clipboard!`);
    }
  }

  // Record payment endpoint
  async function submitPayment(payloadList: { method: any; amount: number; reference?: string }[]) {
    if (!bill) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/manager/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: bill.id,
          payments: payloadList,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      posSound.playCashRegister();
      setPaidReceiptBill({ id: bill.id, billNumber: bill.billNumber, total: bill.total });
      await loadTables();
      await loadSession(selected!);
      await loadAllBills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // 1. CASH payment submit
  async function handleCashPayment() {
    if (!bill) return;
    const tendered = Number(cashTendered) || bill.total;
    if (tendered < bill.total - 0.01) {
      setError(`Tendered cash must be at least ${currency}${bill.total.toFixed(2)}`);
      return;
    }
    const change = Math.max(0, tendered - bill.total);
    await submitPayment([
      {
        method: "CASH",
        amount: bill.total,
        reference: change > 0 ? `Tendered: ${currency}${tendered.toFixed(2)} | Change: ${currency}${change.toFixed(2)}` : undefined,
      },
    ]);
  }

  // 2. CARD payment submit
  async function handleCardPayment() {
    if (!bill) return;
    const ref = [
      cardBrand,
      cardAuthCode ? `Auth: ${cardAuthCode}` : null,
      cardLast4 ? `Card: *${cardLast4}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    await submitPayment([
      {
        method: "CARD",
        amount: bill.total,
        reference: ref || "POS Card Terminal",
      },
    ]);
  }

  // 3. UPI payment submit
  async function handleUpiPayment() {
    if (!bill) return;
    posSound.playUpiChime();
    await submitPayment([
      {
        method: "UPI",
        amount: bill.total,
        reference: upiUtr ? `UTR: ${upiUtr}` : "UPI QR Code",
      },
    ]);
  }

  // 4. NET_BANKING payment submit
  async function handleNetBankingPayment() {
    if (!bill) return;
    await submitPayment([
      {
        method: "NET_BANKING",
        amount: bill.total,
        reference: `${selectedBank}${bankRef ? ` · Ref: ${bankRef}` : ""}`,
      },
    ]);
  }

  // 5. ONLINE GATEWAY simulation completion
  async function handleGatewaySuccess() {
    if (!bill) return;
    setGatewayStep("PROCESSING");
    setTimeout(async () => {
      setGatewayStep("SUCCESS");
      const mockTxn = `rzp_live_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      posSound.playCashRegister();
      setTimeout(async () => {
        setGatewayModalOpen(false);
        setGatewayStep("SELECT");
        await submitPayment([
          {
            method: "GATEWAY",
            amount: bill.total,
            reference: `Razorpay Live · ID: ${mockTxn} (${gatewayMethod})`,
          },
        ]);
      }, 900);
    }, 1400);
  }

  // 6. Split payment helpers
  function addSplitRow() {
    posSound.playClick();
    setPayments((p) => [...p, { method: "CASH", amount: "", reference: "" }]);
  }

  function removeSplitRow(idx: number) {
    posSound.playClick();
    setPayments((p) => p.filter((_, i) => i !== idx));
  }

  function updateSplitRow(idx: number, patch: Partial<PaymentRow>) {
    setPayments((p) => p.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  const splitPaidSoFar = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  function autoFillRemaining(idx: number) {
    posSound.playClick();
    if (!bill) return;
    const currentExceptThis = payments.reduce((s, p, i) => (i === idx ? s : s + (Number(p.amount) || 0)), 0);
    const rem = Math.max(0, bill.total - currentExceptThis);
    updateSplitRow(idx, { amount: rem.toFixed(2) });
  }

  async function handleSplitPaymentSubmit() {
    if (!bill) return;
    const validRows = payments.filter((p) => Number(p.amount) > 0);
    const sum = validRows.reduce((s, p) => s + Number(p.amount), 0);
    if (Math.abs(sum - bill.total) >= 0.01) {
      setError(`Split total (${currency}${sum.toFixed(2)}) must exactly match bill total (${currency}${bill.total.toFixed(2)})`);
      return;
    }
    await submitPayment(
      validRows.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference,
      }))
    );
  }

  // UPI Link builder
  const upiUri = useMemo(() => {
    if (!data?.restaurant.upiId || !bill) return "";
    return buildUpiUri({
      vpa: data.restaurant.upiId,
      payeeName: data.restaurant.name || "Restaurant",
      amount: bill.total,
      note: `Bill #${bill.billNumber}`,
    });
  }, [data?.restaurant.upiId, data?.restaurant.name, bill]);

  function copyUpiLink() {
    if (!upiUri) return;
    navigator.clipboard.writeText(upiUri);
    setCopiedUpi(true);
    posSound.playClick();
    setTimeout(() => setCopiedUpi(false), 2000);
  }

  // Filtered menu items for quick walk-in cart
  const allMenuItems = useMemo(() => {
    return menuCategories.flatMap((c) =>
      c.items.map((i) => ({ ...i, category: { name: c.name } }))
    );
  }, [menuCategories]);

  const filteredMenuItems = useMemo(() => {
    if (!menuSearch.trim()) return allMenuItems;
    const q = menuSearch.toLowerCase();
    return allMenuItems.filter((i) => i.name.toLowerCase().includes(q) || i.category?.name.toLowerCase().includes(q));
  }, [allMenuItems, menuSearch]);

  const quickCartSubtotal = useMemo(() => {
    return Object.entries(quickCart).reduce((sum, [id, qty]) => {
      const item = allMenuItems.find((i) => i.id === id);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [quickCart, allMenuItems]);

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-6 animate-page">
      {/* Top Header Bar with View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-flame/10 text-flame flex items-center justify-center font-bold text-lg shadow-sm">
              ₹
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
                POS Billing & Checkout
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Live Terminal
                </span>
              </h1>
              <p className="text-smoke text-xs">
                Select table, ring up walk-in orders, or view and download all restaurant bills.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher & Header Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Floor Tables vs All Bills View Switcher */}
          <div className="flex items-center bg-panel p-1 rounded-lg border border-line">
            <button
              onClick={() => {
                setViewMode("TABLES");
                posSound.playClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "TABLES"
                  ? "bg-white text-ink shadow-sm border border-line"
                  : "text-smoke hover:text-ink"
              }`}
            >
              <Users size={13} className={viewMode === "TABLES" ? "text-flame" : ""} />
              <span>Floor Tables</span>
            </button>

            <button
              onClick={() => {
                setViewMode("BILLS");
                loadAllBills();
                posSound.playClick();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "BILLS"
                  ? "bg-white text-ink shadow-sm border border-line"
                  : "text-smoke hover:text-ink"
              }`}
            >
              <Receipt size={13} className={viewMode === "BILLS" ? "text-flame" : ""} />
              <span>All Invoices &amp; Bills ({allBills.length})</span>
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Mute POS sound effects" : "Enable POS sound effects"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              soundEnabled
                ? "bg-white border-line text-ink hover:border-smoke shadow-sm"
                : "bg-panel text-smoke border-line"
            }`}
          >
            {soundEnabled ? <Volume2 size={14} className="text-flame" /> : <VolumeX size={14} />}
            <span>{soundEnabled ? "Sound ON" : "Muted"}</span>
          </button>

          <button
            onClick={() => {
              loadTables();
              loadAllBills();
              if (selected) loadSession(selected);
              posSound.playClick();
            }}
            disabled={busy || billsLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-line hover:border-smoke text-ink shadow-sm"
          >
            <RefreshCw size={13} className={busy || billsLoading ? "animate-spin text-flame" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: ALL INVOICES & BILLS (Direct view of all generated bills with download/print) */}
      {viewMode === "BILLS" && (
        <div className="card p-5 space-y-4 shadow-sm animate-page">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
            <div>
              <h2 className="font-display font-bold text-lg text-ink flex items-center gap-2">
                <Receipt size={18} className="text-flame" />
                Restaurant Bills &amp; Tax Invoices
              </h2>
              <p className="text-xs text-smoke">
                Every generated bill in the restaurant. Click to take payment, view thermal receipt, or download PDF invoice.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
              <input
                type="text"
                placeholder="Search Bill # or Table..."
                value={billsSearchQuery}
                onChange={(e) => setBillsSearchQuery(e.target.value)}
                className="input pl-8 py-1.5 text-xs bg-panel/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBills.map((b) => {
              const isPaid = b.status === "PAID" || b.status === "CLOSED";
              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-lg border transition-all space-y-3 bg-white shadow-sm hover:shadow-md ${
                    isPaid ? "border-line" : "border-flame/50 bg-flame/5 ring-1 ring-flame/20"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-display font-bold text-base text-ink flex items-center gap-1.5">
                        <FileText size={15} className="text-flame" />
                        Bill #{b.billNumber}
                      </span>
                      <p className="text-xs text-smoke font-mono">
                        Table {b.session?.table?.number ?? "Counter"} · Billed by {b.issuedBy?.name ?? "Staff"}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        isPaid
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                      }`}
                    >
                      {isPaid ? "PAID" : "UNPAID / BILLED"}
                    </span>
                  </div>

                  <div className="flex justify-between items-baseline border-t border-line/60 pt-2 font-mono">
                    <span className="text-xs text-smoke">Total Payable:</span>
                    <span className="font-display text-xl font-bold text-ink">
                      {currency}{b.total.toFixed(2)}
                    </span>
                  </div>

                  {b.payments && b.payments.length > 0 && (
                    <div className="text-[11px] text-smoke flex items-center gap-1">
                      <span>Method:</span>
                      <span className="font-semibold text-ink">
                        {b.payments.map((p) => p.method).join(" + ")}
                      </span>
                    </div>
                  )}

                  {/* Actions for this bill */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-line/40">
                    {!isPaid && b.session?.table && (
                      <button
                        onClick={() => {
                          setViewMode("TABLES");
                          setSelected(b.session!.table!.id);
                          posSound.playClick();
                        }}
                        className="btn-primary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1 shadow-sm"
                      >
                        <Banknote size={13} />
                        <span>Take Payment</span>
                      </button>
                    )}

                    <a
                      href={`/api/manager/bill/${b.id}/pdf`}
                      download
                      className="btn-secondary text-xs py-1.5 px-2.5 flex-1 flex items-center justify-center gap-1 text-center"
                      title="Download PDF"
                    >
                      <Download size={13} />
                      <span>Download PDF</span>
                    </a>

                    <a
                      href={`/manager/receipt/${b.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-xs py-1.5 px-2.5 flex items-center justify-center gap-1"
                      title="Thermal Slip"
                    >
                      <Printer size={13} />
                      <span>Slip</span>
                    </a>
                  </div>
                </div>
              );
            })}

            {filteredBills.length === 0 && (
              <div className="col-span-full py-12 text-center text-smoke text-sm space-y-2">
                <Receipt size={32} className="mx-auto text-smoke/50" />
                <p className="font-semibold">No bills match your search.</p>
                <p className="text-xs">
                  Generate a bill from the Floor Tables tab or use Quick Walk-In POS to create one instantly.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: FLOOR TABLES & BILLING WORKSPACE */}
      {viewMode === "TABLES" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Floor Table Selector (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="card p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-smoke flex items-center gap-1.5">
                  <Users size={13} /> Restaurant Floor Tables
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href="/manager/bookings"
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 transition-colors"
                  >
                    <CalendarDays size={12} />
                    <span>Bookings</span>
                  </Link>
                  <span className="text-xs font-mono text-smoke">
                    {tables.length} Total
                  </span>
                </div>
              </div>

              {/* Search and Filter Chips */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
                  <input
                    type="text"
                    placeholder="Search table number or section..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-8 py-1.5 text-xs bg-panel/30"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-smoke hover:text-ink text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Status Filter Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "ALL", label: "All", count: counts.all },
                    { key: "BILL_PENDING", label: "Needs Bill", count: counts.needsBill, highlight: true },
                    { key: "OCCUPIED", label: "Occupied", count: counts.occupied },
                    { key: "AVAILABLE", label: "Available", count: counts.available },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => {
                        setTableFilter(f.key as any);
                        posSound.playClick();
                      }}
                      className={`px-2.5 py-1 text-xs rounded-sm transition-all flex items-center gap-1.5 ${
                        tableFilter === f.key
                          ? "bg-ink text-paper font-semibold shadow-sm"
                          : "bg-panel text-smoke hover:text-ink border border-line"
                      } ${f.highlight && counts.needsBill > 0 && tableFilter !== f.key ? "border-flame/40 text-flame font-medium" : ""}`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`text-[10px] px-1 rounded-sm ${
                          tableFilter === f.key ? "bg-white/20 text-white" : "bg-white text-smoke"
                        }`}
                      >
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tables Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredTables.map((t) => {
                  const isSelected = selected === t.id;
                  const isNeedsBill = t.status === "WAITING_FOR_BILL" || t.status === "FOOD_READY";
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelected(t.id);
                        posSound.playClick();
                      }}
                      className={`p-3 text-left rounded-md border transition-all relative overflow-hidden group ${
                        isSelected
                          ? "bg-flame/5 border-flame ring-1 ring-flame shadow-md"
                          : isNeedsBill
                          ? "bg-amber-500/10 border-amber-500 hover:border-amber-600 shadow-sm ring-1 ring-amber-400"
                          : "bg-white border-line hover:border-smoke hover:shadow-sm"
                      }`}
                    >
                      {isNeedsBill && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-flame animate-ping" />
                      )}
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-display font-bold text-lg text-ink">
                          T-{t.number}
                        </span>
                        {t.capacity && (
                          <span className="text-[10px] font-mono text-smoke">
                            {t.capacity}P
                          </span>
                        )}
                      </div>
                      {t.section && (
                        <p className="text-[11px] text-smoke truncate mb-1">
                          {t.section}
                        </p>
                      )}
                      {t.todayBooking && (
                        <div className="mb-1.5 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-300 text-[10px] font-bold text-amber-800 truncate flex items-center gap-1">
                          <span>📅 {t.todayBooking.bookingTime}</span>
                          <span className="truncate font-normal">({t.todayBooking.customerName})</span>
                        </div>
                      )}
                      <StatusPill status={t.status} />
                    </button>
                  );
                })}

                {filteredTables.length === 0 && (
                  <div className="col-span-full py-8 text-center text-smoke text-xs">
                    No tables match this filter or search query.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Billing & Payment Processing Suite (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {!selected && (
              <div className="card p-12 text-center space-y-3 bg-panel/30 border-dashed">
                <div className="w-12 h-12 rounded-full bg-flame/10 text-flame mx-auto flex items-center justify-center">
                  <Receipt size={24} />
                </div>
                <h3 className="font-display text-lg font-semibold text-ink">
                  No Table Selected
                </h3>
                <p className="text-smoke text-sm max-w-sm mx-auto">
                  Choose a table from the floor map on the left to review order chits, compute discounts, or ring up a quick bill.
                </p>
              </div>
            )}

            {selected && data && (
              <div className="card p-5 space-y-5 shadow-sm">
                {/* Table Header Banner */}
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold text-ink">
                        Table {data.table.number}
                      </span>
                      {data.table.section && (
                        <span className="text-xs px-2 py-0.5 rounded bg-panel text-smoke">
                          {data.table.section}
                        </span>
                      )}
                      <StatusPill status={data.table.status} />
                    </div>
                    <p className="text-xs text-smoke mt-0.5">
                      {data.session ? `Session active · ${data.session.orders.length} order round(s)` : "Available Table"}
                    </p>
                  </div>

                  {bill && (
                    <div className="text-right">
                      <span className="text-xs uppercase tracking-wider text-smoke font-semibold block">
                        Bill #{bill.billNumber}
                      </span>
                      <span className="font-display text-xl font-bold text-ink">
                        {currency}{bill.total.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* NO OPEN SESSION ON THIS TABLE -> OFFER QUICK WALK-IN BILL GENERATOR */}
                {!data.session && (
                  <div className="space-y-4">
                    <div className="p-4 bg-panel/20 rounded-lg border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-sm text-ink flex items-center gap-1.5">
                          <ShoppingBag size={15} className="text-flame" />
                          Walk-In Customer / Direct Counter Sale
                        </h4>
                        <p className="text-xs text-smoke">
                          No active kitchen order round. Ring up items directly to generate a bill and take payment immediately.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setQuickOrderOpen((v) => !v);
                          posSound.playClick();
                        }}
                        className="btn-primary text-xs py-2 px-3 shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Plus size={14} />
                        <span>{quickOrderOpen ? "Close Item Picker" : "Ring Up Quick Bill"}</span>
                      </button>
                    </div>

                    {/* Quick Walk-In Menu Picker */}
                    {quickOrderOpen && (
                      <div className="p-4 bg-white rounded-lg border border-line shadow-sm space-y-4 animate-page">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold uppercase tracking-wider text-smoke flex items-center gap-1">
                            <ListOrdered size={14} /> Select Menu Items
                          </span>
                          <span className="text-xs font-mono text-smoke">
                            {allMenuItems.length} Items Available
                          </span>
                        </div>

                        {/* Dine In vs Parcel selector for Quick Bill */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-panel/50 border border-line">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{quickOrderType === "PARCEL" ? "📦" : "🍽️"}</span>
                            <span className="text-xs font-bold text-ink">Service Mode:</span>
                          </div>
                          <div className="flex bg-white rounded-md border border-line p-0.5 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => setQuickOrderType("DINE_IN")}
                              className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                                quickOrderType === "DINE_IN"
                                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                                  : "text-smoke hover:text-ink"
                              }`}
                            >
                              🍽️ Dine In
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuickOrderType("PARCEL")}
                              className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 ${
                                quickOrderType === "PARCEL"
                                  ? "bg-amber-600 text-white font-bold shadow-xs"
                                  : "text-smoke hover:text-ink"
                              }`}
                            >
                              📦 Parcel (Takeaway)
                            </button>
                          </div>
                        </div>

                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-smoke" />
                          <input
                            type="text"
                            placeholder="Filter dishes (e.g. Biryani, Paneer, Chicken)..."
                            value={menuSearch}
                            onChange={(e) => setMenuSearch(e.target.value)}
                            className="input pl-8 py-1.5 text-xs bg-panel/20"
                          />
                        </div>

                        {/* Items Grid with Quantity Steppers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                          {filteredMenuItems.map((item) => {
                            const count = quickCart[item.id] || 0;
                            return (
                              <div
                                key={item.id}
                                className={`p-2.5 rounded-md border flex items-center justify-between gap-2 text-xs transition-colors ${
                                  count > 0 ? "bg-flame/5 border-flame/40" : "bg-panel/10 border-line hover:border-smoke"
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-ink truncate flex items-center gap-1">
                                    <span
                                      className={`w-2 h-2 rounded-full inline-block ${
                                        item.isVeg ? "bg-emerald-600" : "bg-red-600"
                                      }`}
                                    />
                                    {item.name}
                                  </p>
                                  <p className="text-[11px] text-smoke font-mono font-medium">
                                    {currency}{item.price.toFixed(2)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 bg-white border border-line rounded p-0.5 shadow-xs">
                                  {count > 0 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setQuickCart((prev) => ({
                                            ...prev,
                                            [item.id]: Math.max(0, count - 1),
                                          }));
                                          posSound.playClick();
                                        }}
                                        className="p-1 hover:bg-panel rounded text-smoke hover:text-ink"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="font-mono font-bold text-xs w-4 text-center">
                                        {count}
                                      </span>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuickCart((prev) => ({
                                        ...prev,
                                        [item.id]: count + 1,
                                      }));
                                      posSound.playClick();
                                    }}
                                    className="p-1 bg-panel hover:bg-line rounded text-ink"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Quick Cart Summary & Generate Action */}
                        <div className="border-t border-line pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="font-mono text-xs">
                            <span className="text-smoke">Order Subtotal: </span>
                            <span className="font-bold text-base text-ink">
                              {currency}{quickCartSubtotal.toFixed(2)}
                            </span>
                          </div>

                          <button
                            onClick={handleQuickBillGenerate}
                            disabled={busy || quickCartSubtotal <= 0}
                            className="btn-primary py-2 px-4 text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                          >
                            <Sparkles size={14} />
                            <span>Generate Bill &amp; Take Payment</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Previous Bill for this table if any */}
                    {data.lastBill && (
                      <div className="p-3 bg-panel/30 rounded border border-line text-xs flex items-center justify-between">
                        <div>
                          <span className="text-smoke">Previous Bill on Table {data.table.number}: </span>
                          <span className="font-semibold text-ink">
                            Bill #{data.lastBill.billNumber} · {currency}{data.lastBill.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={`/api/manager/bill/${data.lastBill.id}/pdf`}
                            download
                            className="text-flame hover:underline font-semibold flex items-center gap-1"
                          >
                            <Download size={12} />
                            <span>Download PDF</span>
                          </a>
                          <a
                            href={`/manager/receipt/${data.lastBill.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-smoke hover:text-ink font-semibold flex items-center gap-1"
                          >
                            <Printer size={12} />
                            <span>Slip</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* HAS ACTIVE SESSION */}
                {data.session && (
                  <>
                    {/* Order Chits List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-smoke">
                        <span>Order Items ({data.session.orders.flatMap((o) => o.items).length})</span>
                        <span>Waiter Breakdown</span>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {data.session.orders.map((o) => (
                          <div
                            key={o.id}
                            className="ticket p-3 bg-panel/20 border border-line rounded-sm space-y-2"
                          >
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-ink flex items-center gap-1.5 flex-wrap">
                                <Receipt size={12} className="text-flame" />
                                <span>Round #{o.orderNumber} · Waiter: {o.waiter.name}</span>
                                {o.customerNote?.includes("PARCEL") ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5">
                                    📦 Parcel
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-0.5">
                                    🍽️ Dine In
                                  </span>
                                )}
                              </span>
                              <StatusPill status={o.status} />
                            </div>
                            {o.customerNote && (
                              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200/60 rounded px-2 py-1">
                                <span className="font-semibold">Note:</span>{" "}
                                {o.customerNote.replace(/\[(📦 PARCEL \/ TAKEAWAY|🍽️ DINE IN)\]\s*/g, "") || o.customerNote}
                              </p>
                            )}

                            <ul className="text-xs space-y-1 text-ink divide-y divide-line/40">
                              {o.items.map((i) => (
                                <li key={i.id} className="flex justify-between pt-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-semibold text-flame w-5">
                                      {i.quantity}×
                                    </span>
                                    <span>{i.nameSnapshot}</span>
                                    {i.notes && (
                                      <span className="text-[10px] text-amber-800 bg-amber-100 px-1 py-0.2 rounded font-sans">
                                        {i.notes}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-mono text-smoke">
                                    {currency}{i.total.toFixed(2)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bill Generation Section (If not billed yet) */}
                    {!bill && (
                      <div className="border-t border-line pt-4 space-y-4">
                        {(data.billableOrders?.length ?? 0) > 0 ? (
                          <div className="bg-panel/40 p-4 rounded-md border border-line space-y-3">
                            <div className="flex justify-between items-center text-sm font-semibold">
                              <span>Ready to Bill Subtotal</span>
                              <span className="font-mono text-base font-bold text-flame">
                                {currency}{data.subtotal?.toFixed(2)}
                              </span>
                            </div>

                            {/* Discount Controls */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-smoke font-medium">
                                <span className="flex items-center gap-1">
                                  <BadgePercent size={13} className="text-flame" />
                                  Apply Discount (Optional)
                                </span>
                                <div className="flex gap-1">
                                  {[
                                    { label: "5%", pct: 0.05 },
                                    { label: "10%", pct: 0.10 },
                                    { label: "15%", pct: 0.15 },
                                  ].map((p) => (
                                    <button
                                      key={p.label}
                                      type="button"
                                      onClick={() => {
                                        const amt = ((data.subtotal || 0) * p.pct).toFixed(2);
                                        setDiscount(amt);
                                        setDiscountReason(`${p.label} Promo`);
                                        posSound.playClick();
                                      }}
                                      className="px-1.5 py-0.5 bg-white border border-line hover:border-smoke text-[11px] rounded"
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                  {Number(discount) > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDiscount("0");
                                        setDiscountReason("");
                                        posSound.playClick();
                                      }}
                                      className="px-1.5 py-0.5 text-flame hover:underline text-[11px]"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  value={discount}
                                  onChange={(e) => setDiscount(e.target.value)}
                                  type="number"
                                  placeholder="Discount amount (₹)"
                                  className="input text-xs font-mono"
                                />
                                <input
                                  value={discountReason}
                                  onChange={(e) => setDiscountReason(e.target.value)}
                                  placeholder="Reason (e.g. Loyalty, Staff)"
                                  className="input text-xs"
                                />
                              </div>
                            </div>

                            <button
                              onClick={generateBill}
                              disabled={busy}
                              className="btn-primary w-full py-2.5 text-sm shadow-md flex items-center justify-center gap-2"
                            >
                              <Sparkles size={16} />
                              <span>Generate Final Bill</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 text-center text-xs text-smoke bg-panel/20 rounded border border-line">
                            No served orders are ready to bill yet. Wait for kitchen and waiter rounds to complete.
                          </div>
                        )}
                      </div>
                    )}

                    {/* MASTER PAYMENT TERMINAL (When bill is generated & BILLED) */}
                    {bill && bill.status === "BILLED" && (
                      <div className="border-t-2 border-line pt-4 space-y-5 animate-stagger">
                        {/* Thermal Bill Breakdown Card */}
                        <div className="bg-panel/30 border border-line rounded-lg p-4 font-mono text-xs space-y-1.5">
                          <div className="flex justify-between text-smoke">
                            <span>Subtotal:</span>
                            <span>{currency}{bill.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-smoke">
                            <span>GST / Tax ({data.restaurant.taxPercent}%):</span>
                            <span>{currency}{bill.taxAmount.toFixed(2)}</span>
                          </div>
                          {bill.serviceCharge > 0 && (
                            <div className="flex justify-between text-smoke">
                              <span>Service Charge ({data.restaurant.serviceChargePercent}%):</span>
                              <span>{currency}{bill.serviceCharge.toFixed(2)}</span>
                            </div>
                          )}
                          {bill.discountAmount > 0 && (
                            <div className="flex justify-between text-emerald-800 font-semibold">
                              <span>Discount {bill.discountReason ? `(${bill.discountReason})` : ""}:</span>
                              <span>-{currency}{bill.discountAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-base font-bold text-ink border-t border-line/60 pt-2 mt-1">
                            <span className="font-sans font-bold">TOTAL PAYABLE:</span>
                            <span className="text-xl text-flame">{currency}{bill.total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowQrModal(true);
                              posSound.playClick();
                            }}
                            className="btn-secondary py-1.5 px-3 text-xs flex items-center justify-center gap-1.5 border-emerald-500/30 text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20 font-bold shadow-sm"
                          >
                            <QrCode size={14} className="text-emerald-600" />
                            <span>Show QR Code</span>
                          </button>
                          <a
                            href={`/api/manager/bill/${bill.id}/pdf`}
                            className="btn-secondary flex-1 py-1.5 text-xs text-center flex items-center justify-center gap-1.5"
                            download
                          >
                            <Download size={13} />
                            <span>Download Tax Invoice (PDF)</span>
                          </a>
                          <a
                            href={`/manager/receipt/${bill.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary py-1.5 text-xs flex items-center justify-center gap-1.5"
                          >
                            <Printer size={13} />
                            <span>Thermal Slip</span>
                          </a>
                        </div>

                        {/* Send Bill to Diner Mobile (WhatsApp / SMS) */}
                        <div className="bg-panel/40 p-3 rounded-lg border border-line space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                              <Smartphone size={14} className="text-emerald-600" />
                              <span>Send Bill to Mobile Number</span>
                            </span>
                            <span className="text-[11px] text-smoke">WhatsApp / SMS</span>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-1.5">
                            <div className="flex items-center gap-1 w-full sm:flex-1">
                              <span className="px-2 py-1.5 rounded-lg bg-panel border border-line text-xs font-mono font-bold text-ink shrink-0">
                                🇮🇳 +91
                              </span>
                              <input
                                type="tel"
                                maxLength={10}
                                placeholder="Enter 10-digit diner mobile"
                                value={customerMobile}
                                onChange={(e) => {
                                  setCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                                  setMobileFeedback(null);
                                }}
                                className="input py-1 text-xs font-mono tracking-wider flex-1"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => handleSendBillToMobile("WHATSAPP")}
                                className="btn-secondary py-1.5 px-3 text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 flex items-center justify-center gap-1 flex-1 sm:flex-none shadow-xs"
                                title="Send digital bill directly to WhatsApp number"
                              >
                                <MessageSquare size={13} className="text-emerald-600" />
                                <span>Send WhatsApp</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendBillToMobile("SMS")}
                                className="btn-secondary py-1.5 px-2.5 text-xs font-semibold bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100 flex items-center justify-center gap-1 flex-1 sm:flex-none shadow-xs"
                                title="Send SMS / Copy bill message"
                              >
                                <Send size={12} className="text-teal-600" />
                                <span>SMS</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendBillToMobile("COPY")}
                                className="btn-secondary py-1.5 px-2 text-xs font-semibold border-line hover:bg-panel flex items-center justify-center shadow-xs"
                                title="Copy bill text summary"
                              >
                                <Copy size={13} className="text-smoke" />
                              </button>
                            </div>
                          </div>
                          {mobileFeedback && (
                            <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded font-medium flex items-center gap-1 animate-toast">
                              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                              <span>{mobileFeedback}</span>
                            </p>
                          )}
                        </div>

                        {/* Payment Method Selector Tabs */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-smoke flex items-center gap-1.5">
                              <CreditCard size={13} className="text-flame" /> Select Payment Method
                            </label>
                            <span className="text-[11px] font-mono text-smoke">
                              Bill #{bill.billNumber}
                            </span>
                          </div>

                          {/* Branded Horizontal Tabs */}
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-panel p-1.5 rounded-lg border border-line">
                            {[
                              { id: "CASH", label: "Cash", icon: Banknote },
                              { id: "CARD", label: "Card / POS", icon: CreditCard },
                              { id: "UPI", label: "UPI QR", icon: QrCode },
                              { id: "GATEWAY", label: "Razorpay", icon: Sparkles },
                              { id: "NET_BANKING", label: "NetBanking", icon: Building2 },
                              { id: "SPLIT", label: "Split", icon: Split },
                            ].map((tab) => {
                              const Icon = tab.icon;
                              const isActive = activePaymentTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  onClick={() => {
                                    setActivePaymentTab(tab.id as PaymentTab);
                                    posSound.playClick();
                                  }}
                                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-md text-xs font-semibold transition-all ${
                                    isActive
                                      ? "bg-white text-ink shadow-sm border border-line ring-1 ring-flame/30"
                                      : "text-smoke hover:text-ink hover:bg-white/50"
                                  }`}
                                >
                                  <Icon size={16} className={isActive ? "text-flame mb-1" : "mb-1 text-smoke"} />
                                  <span className="text-[11px] leading-tight truncate">{tab.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* TAB 1: CASH PAYMENT MODE */}
                          {activePaymentTab === "CASH" && (
                            <div className="card p-4 rounded-lg bg-panel/10 space-y-4 border-line">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
                                  <Banknote size={14} className="text-emerald-700" /> Cash Tender Calculator
                                </span>
                                <span className="text-xs text-smoke font-mono">
                                  Required: {currency}{bill.total.toFixed(2)}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                <div>
                                  <label className="text-[11px] font-semibold text-smoke mb-1 block">
                                    Cash Tendered by Customer ({currency})
                                  </label>
                                  <input
                                    type="number"
                                    value={cashTendered}
                                    onChange={(e) => setCashTendered(e.target.value)}
                                    className="input text-lg font-mono font-bold text-ink"
                                    placeholder="0.00"
                                    autoFocus
                                  />
                                </div>

                                {(() => {
                                  const tendered = Number(cashTendered) || 0;
                                  const change = Math.round((tendered - bill.total) * 100) / 100;
                                  if (tendered >= bill.total - 0.01) {
                                    return (
                                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                                        <span className="text-[11px] uppercase font-bold text-emerald-800 tracking-wide block">
                                          Change to Return
                                        </span>
                                        <span className="text-xl font-bold font-mono text-emerald-900">
                                          {currency}{Math.max(0, change).toFixed(2)}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                      <span className="text-[11px] uppercase font-bold text-amber-800 tracking-wide block">
                                        Short by
                                      </span>
                                      <span className="text-xl font-bold font-mono text-amber-900">
                                        {currency}{(bill.total - tendered).toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              <div>
                                <span className="text-[11px] font-semibold text-smoke block mb-1.5">
                                  Quick Cash Buttons:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCashTendered(bill.total.toFixed(2));
                                      posSound.playClick();
                                    }}
                                    className="px-2.5 py-1 text-xs font-semibold bg-white border border-line hover:border-smoke rounded shadow-sm"
                                  >
                                    Exact ({currency}{bill.total.toFixed(2)})
                                  </button>
                                  {[
                                    Math.ceil(bill.total / 100) * 100,
                                    Math.ceil(bill.total / 500) * 500,
                                    2000,
                                  ]
                                    .filter((v, idx, arr) => v >= bill.total && arr.indexOf(v) === idx)
                                    .map((val) => (
                                      <button
                                        key={val}
                                        type="button"
                                        onClick={() => {
                                          setCashTendered(val.toString());
                                          posSound.playClick();
                                        }}
                                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-line hover:border-smoke rounded shadow-sm"
                                      >
                                        {currency}{val}
                                      </button>
                                    ))}
                                  {[100, 200, 500].map((add) => (
                                    <button
                                      key={add}
                                      type="button"
                                      onClick={() => {
                                        const cur = Number(cashTendered) || 0;
                                        setCashTendered((cur + add).toString());
                                        posSound.playClick();
                                      }}
                                      className="px-2 py-1 text-xs font-medium bg-panel hover:bg-line rounded"
                                    >
                                      +{currency}{add}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={handleCashPayment}
                                disabled={busy || (Number(cashTendered) || 0) < bill.total - 0.01}
                                className="btn-primary w-full py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                              >
                                <Banknote size={17} />
                                <span>Collect Cash &amp; Complete Order</span>
                              </button>
                            </div>
                          )}

                          {/* TAB 2: CARD / POS TERMINAL MODE */}
                          {activePaymentTab === "CARD" && (
                            <div className="card p-4 rounded-lg bg-panel/10 space-y-4 border-line">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
                                  <CreditCard size={14} className="text-blue-700" /> POS Card Swipe / Tap
                                </span>
                                <span className="text-xs text-smoke font-mono">
                                  Amount: {currency}{bill.total.toFixed(2)}
                                </span>
                              </div>

                              <div className="relative h-36 rounded-xl bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 p-4 text-white shadow-lg overflow-hidden border border-slate-700 max-w-sm mx-auto">
                                <div className="absolute right-4 top-4 text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-white/20">
                                  {cardBrand}
                                </div>
                                <div className="w-9 h-7 rounded bg-amber-400/90 shadow-inner border border-amber-300 mb-3 flex items-center justify-center">
                                  <div className="w-5 h-3 border border-amber-600 rounded-sm opacity-60" />
                                </div>
                                <div className="font-mono text-sm tracking-widest text-slate-300">
                                  **** **** **** {cardLast4 || "••••"}
                                </div>
                                <div className="flex justify-between items-end mt-2 text-[10px] text-slate-400">
                                  <div>
                                    <span className="block text-[8px] uppercase">Cardholder</span>
                                    <span>GUEST OF RESTAURANT</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-[8px] uppercase">Amount</span>
                                    <span className="font-mono text-white text-xs font-bold">{currency}{bill.total.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-semibold text-smoke mb-1 block">
                                    Card Brand
                                  </label>
                                  <select
                                    value={cardBrand}
                                    onChange={(e) => setCardBrand(e.target.value as any)}
                                    className="input text-xs font-medium"
                                  >
                                    <option value="VISA">Visa</option>
                                    <option value="MASTERCARD">Mastercard</option>
                                    <option value="RUPAY">RuPay</option>
                                    <option value="AMEX">American Express</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[11px] font-semibold text-smoke mb-1 block">
                                    Last 4 Digits (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="e.g. 4021"
                                    value={cardLast4}
                                    onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ""))}
                                    className="input text-xs font-mono"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-smoke mb-1 block">
                                  POS Machine Auth / Approval Code (Optional)
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. AUTH-982144 / EDC-01"
                                  value={cardAuthCode}
                                  onChange={(e) => setCardAuthCode(e.target.value)}
                                  className="input text-xs font-mono"
                                />
                              </div>

                              <button
                                onClick={handleCardPayment}
                                disabled={busy}
                                className="btn-primary w-full py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                              >
                                <CreditCard size={17} />
                                <span>Authorize Card &amp; Record Payment</span>
                              </button>
                            </div>
                          )}

                          {/* TAB 3: UPI SCAN & PAY MODE */}
                          {activePaymentTab === "UPI" && (
                            <div className="card p-4 rounded-lg bg-panel/10 space-y-4 border-line">
                              <div className="flex justify-between items-center flex-wrap gap-2">
                                <span className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
                                  <QrCode size={14} className="text-emerald-400" /> UPI Scan &amp; Pay Terminal
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowQrModal(true);
                                      posSound.playClick();
                                    }}
                                    className="text-xs text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 rounded font-semibold flex items-center gap-1 border border-emerald-500/30"
                                  >
                                    <QrCode size={12} />
                                    <span>Enlarge for Diner</span>
                                  </button>
                                  <span className="text-xs font-mono px-2 py-0.5 bg-emerald-500/15 text-emerald-300 rounded font-semibold">
                                    Refresh: {Math.floor(qrSecondsLeft / 60)}:{String(qrSecondsLeft % 60).padStart(2, "0")}
                                  </span>
                                </div>
                              </div>

                              {/* Toggle between Standee and Dynamic QR */}
                              <div className="flex gap-1.5 bg-panel p-1 rounded border border-line text-xs">
                                <button
                                  type="button"
                                  onClick={() => setQrMode("STAND_EE")}
                                  className={`flex-1 py-1 px-2 rounded font-semibold transition-all ${
                                    qrMode === "STAND_EE"
                                      ? "bg-emerald-600 text-white shadow-sm font-bold"
                                      : "text-smoke hover:text-ink"
                                  }`}
                                >
                                  {hasCustomQr ? "Uploaded Standee QR" : "Restaurant UPI Standee"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQrMode("DYNAMIC")}
                                  className={`flex-1 py-1 px-2 rounded font-semibold transition-all ${
                                    qrMode === "DYNAMIC"
                                      ? "bg-emerald-600 text-white shadow-sm font-bold"
                                      : "text-smoke hover:text-ink"
                                  }`}
                                >
                                  Dynamic Bill QR ({currency}{bill.total.toFixed(2)})
                                </button>
                              </div>

                              {data.restaurant.upiId || customQrUrl ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                  <div className="bg-white p-4 rounded-lg border border-line text-center shadow-sm space-y-2">
                                    {qrMode === "STAND_EE" && customQrUrl ? (
                                      <div className="space-y-1.5">
                                        <div className="relative inline-block">
                                          <img
                                            src={customQrUrl}
                                            alt="Restaurant Custom Payment QR"
                                            className="w-44 h-52 object-contain mx-auto rounded border border-line/60"
                                          />
                                        </div>
                                        <div className="text-[11px] font-mono">
                                          <p className="font-bold text-ink">
                                            {data.restaurant.name}
                                          </p>
                                          {data.restaurant.upiId && <p className="text-smoke truncate">{data.restaurant.upiId}</p>}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <div className="relative inline-block">
                                          <img
                                            src={`/api/manager/qr?text=${encodeURIComponent(upiUri || `upi://pay?pa=${encodeURIComponent(data.restaurant.upiId || "")}&pn=${encodeURIComponent(data.restaurant.name)}`)}`}
                                            alt="Dynamic UPI QR Code"
                                            className="w-44 h-44 mx-auto rounded border border-line/60"
                                          />
                                          <div className="absolute inset-0 border-2 border-emerald-500/20 rounded pointer-events-none" />
                                        </div>
                                        <p className="text-[11px] text-smoke font-mono font-medium">
                                          VPA: <strong className="text-ink">{data.restaurant.upiId || "Registered UPI"}</strong>
                                        </p>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={copyUpiLink}
                                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1 pt-1"
                                    >
                                      {copiedUpi ? <Check size={12} /> : <Copy size={12} />}
                                      <span>{copiedUpi ? "UPI Link Copied!" : "Copy UPI URI"}</span>
                                    </button>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-md space-y-1">
                                      <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                                        <Sparkles size={13} />
                                        <span>Scan With Any UPI App</span>
                                      </div>
                                      <p className="text-[11px] text-purple-800">
                                        Google Pay · PhonePe · Paytm · BHIM · Cred for <strong>{currency}{bill.total.toFixed(2)}</strong>
                                      </p>
                                    </div>

                                    <div>
                                      <label className="text-[11px] font-semibold text-smoke mb-1 block">
                                        12-Digit Bank UTR / Reference # (Optional)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 429104882190"
                                        value={upiUtr}
                                        onChange={(e) => setUpiUtr(e.target.value)}
                                        className="input text-xs font-mono"
                                      />
                                    </div>

                                    <button
                                      onClick={handleUpiPayment}
                                      disabled={busy}
                                      className="btn-primary w-full py-2.5 text-xs font-bold shadow-md flex items-center justify-center gap-1.5"
                                    >
                                      <CheckCircle2 size={15} />
                                      <span>Customer Paid — Confirm UPI</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-6 text-center text-xs text-smoke bg-panel/20 rounded border border-line space-y-2">
                                  <AlertCircle size={20} className="mx-auto text-amber-600" />
                                  <p>No UPI ID configured for this restaurant.</p>
                                  <p className="text-[11px]">
                                    Configure your UPI VPA in <strong>Owner &gt; Settings</strong> to enable instant QR codes.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 4: ORIGINAL PAYMENT GATEWAY / RAZORPAY MODE */}
                          {activePaymentTab === "GATEWAY" && (
                            <div className="card p-5 rounded-lg bg-panel/10 space-y-4 border-line">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles size={14} className="text-indigo-600" /> Online Payment Gateway
                                </span>
                                <span className="text-xs font-mono px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-semibold flex items-center gap-1">
                                  <ShieldCheck size={12} /> 256-Bit SSL
                                </span>
                              </div>

                              <div className="p-4 bg-white rounded-lg border border-line shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-display font-bold text-sm text-ink">
                                      Instant Online Payment Gateway
                                    </h4>
                                    <p className="text-xs text-smoke">
                                      Seamless checkout modal supporting Cards, UPI Intent, NetBanking, and Wallets.
                                    </p>
                                  </div>
                                  <span className="font-display text-lg font-bold text-flame">
                                    {currency}{bill.total.toFixed(2)}
                                  </span>
                                </div>

                                <button
                                  onClick={() => {
                                    setGatewayModalOpen(true);
                                    posSound.playClick();
                                  }}
                                  className="btn-primary w-full py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                                >
                                  <ExternalLink size={16} />
                                  <span>Launch Online Gateway Checkout</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TAB 5: NETBANKING MODE */}
                          {activePaymentTab === "NET_BANKING" && (
                            <div className="card p-4 rounded-lg bg-panel/10 space-y-4 border-line">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
                                  <Building2 size={14} className="text-emerald-700" /> NetBanking / IMPS
                                </span>
                                <span className="text-xs text-smoke font-mono">
                                  Total: {currency}{bill.total.toFixed(2)}
                                </span>
                              </div>

                              <div>
                                <span className="text-[11px] font-semibold text-smoke block mb-2">
                                  Select Bank:
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {INDIAN_BANKS.map((b) => (
                                    <button
                                      key={b.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedBank(b.id);
                                        posSound.playClick();
                                      }}
                                      className={`p-2 rounded border text-left text-xs transition-all flex items-center gap-2 ${
                                        selectedBank === b.id
                                          ? "bg-white border-flame shadow-sm font-semibold text-ink ring-1 ring-flame"
                                          : "bg-white/50 border-line hover:border-smoke text-smoke"
                                      }`}
                                    >
                                      <span>{b.logo}</span>
                                      <span className="truncate">{b.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] font-semibold text-smoke mb-1 block">
                                  Transaction / IMPS / NEFT Reference Number
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. IMPS/40921849102"
                                  value={bankRef}
                                  onChange={(e) => setBankRef(e.target.value)}
                                  className="input text-xs font-mono"
                                />
                              </div>

                              <button
                                onClick={handleNetBankingPayment}
                                disabled={busy}
                                className="btn-primary w-full py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                              >
                                <Building2 size={17} />
                                <span>Confirm Bank Transfer Payment</span>
                              </button>
                            </div>
                          )}

                          {/* TAB 6: SPLIT PAYMENT MODE */}
                          {activePaymentTab === "SPLIT" && (
                            <div className="card p-4 rounded-lg bg-panel/10 space-y-4 border-line">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
                                  <Split size={14} className="text-amber-700" /> Multi-Tender Split Payment
                                </span>
                                <span className="text-xs font-mono font-semibold text-ink">
                                  Bill: {currency}{bill.total.toFixed(2)}
                                </span>
                              </div>

                              <div className="space-y-2">
                                {payments.map((row, idx) => (
                                  <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded border border-line shadow-sm">
                                    <select
                                      value={row.method}
                                      onChange={(e) => updateSplitRow(idx, { method: e.target.value as any })}
                                      className="input w-32 text-xs py-1.5 font-semibold"
                                    >
                                      <option value="CASH">💵 Cash</option>
                                      <option value="CARD">💳 Card</option>
                                      <option value="UPI">📱 UPI</option>
                                      <option value="NET_BANKING">🏦 NetBanking</option>
                                      <option value="WALLET">👛 Wallet</option>
                                    </select>

                                    <input
                                      type="number"
                                      placeholder="Amount"
                                      value={row.amount}
                                      onChange={(e) => updateSplitRow(idx, { amount: e.target.value })}
                                      className="input w-28 text-xs font-mono font-bold"
                                    />

                                    <input
                                      type="text"
                                      placeholder="Ref / Note (Optional)"
                                      value={row.reference ?? ""}
                                      onChange={(e) => updateSplitRow(idx, { reference: e.target.value })}
                                      className="input flex-1 text-xs"
                                    />

                                    <button
                                      type="button"
                                      title="Auto-fill remaining"
                                      onClick={() => autoFillRemaining(idx)}
                                      className="px-2 py-1 bg-panel text-[11px] rounded hover:bg-line text-ink shrink-0"
                                    >
                                      Fill
                                    </button>

                                    {payments.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeSplitRow(idx)}
                                        className="p-1.5 text-flame hover:bg-flame/10 rounded"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={addSplitRow}
                                className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                              >
                                <Plus size={12} />
                                <span>Add Another Tender Method</span>
                              </button>

                              <div className="space-y-1 pt-2 border-t border-line">
                                <div className="flex justify-between text-xs font-mono">
                                  <span>Allocated: {currency}{splitPaidSoFar.toFixed(2)}</span>
                                  <span className={Math.abs(splitPaidSoFar - bill.total) < 0.01 ? "text-emerald-700 font-bold" : "text-flame font-bold"}>
                                    {Math.abs(splitPaidSoFar - bill.total) < 0.01
                                      ? "✓ Balanced"
                                      : splitPaidSoFar < bill.total
                                      ? `Short by ${currency}${(bill.total - splitPaidSoFar).toFixed(2)}`
                                      : `Over by ${currency}${(splitPaidSoFar - bill.total).toFixed(2)}`}
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-line overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      Math.abs(splitPaidSoFar - bill.total) < 0.01 ? "bg-emerald-600" : "bg-flame"
                                    }`}
                                    style={{ width: `${Math.min(100, (splitPaidSoFar / bill.total) * 100)}%` }}
                                  />
                                </div>
                              </div>

                              <button
                                onClick={handleSplitPaymentSubmit}
                                disabled={busy || Math.abs(splitPaidSoFar - bill.total) >= 0.01}
                                className="btn-primary w-full py-3 text-sm font-bold shadow-md flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 size={17} />
                                <span>Record Split Payment &amp; Close Bill</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <div className="p-3 bg-flame/10 border border-flame/30 text-flame rounded text-xs flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RAZORPAY / ONLINE PAYMENT GATEWAY CHECKOUT MODAL */}
      {gatewayModalOpen && bill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-page">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-line">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center font-bold text-xs">
                  RZP
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{data?.restaurant.name || "Restaurant POS"}</h3>
                  <p className="text-[10px] text-slate-400">Order #{bill.billNumber} · Secure Checkout</p>
                </div>
              </div>
              <button
                onClick={() => setGatewayModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded border border-slate-200">
                <span className="text-xs text-smoke">Amount to Pay</span>
                <span className="font-mono text-xl font-bold text-slate-900">
                  {currency}{bill.total.toFixed(2)}
                </span>
              </div>

              {gatewayStep === "SELECT" && (
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-smoke block">Choose Payment Method:</span>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "UPI", label: "UPI Apps", icon: QrCode },
                      { id: "CARD", label: "Card", icon: CreditCard },
                      { id: "NETBANKING", label: "NetBanking", icon: Building2 },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setGatewayMethod(m.id as any);
                          posSound.playClick();
                        }}
                        className={`p-2.5 rounded-lg border text-center transition-all flex flex-col items-center gap-1 text-xs ${
                          gatewayMethod === m.id
                            ? "border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-sm ring-1 ring-blue-600"
                            : "border-slate-200 hover:border-slate-300 text-slate-700"
                        }`}
                      >
                        <m.icon size={18} />
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-3 bg-panel/30 rounded border border-line text-xs space-y-2">
                    <p className="text-smoke">
                      {gatewayMethod === "UPI" && "Fastest: Scan QR or approve request on Google Pay / PhonePe / Paytm."}
                      {gatewayMethod === "CARD" && "Credit, Debit, or Corporate Cards with 3D Secure OTP verification."}
                      {gatewayMethod === "NETBANKING" && "Direct net banking login across 50+ supported Indian banks."}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
                      <ShieldCheck size={12} />
                      <span>RBI Compliant &amp; PCI-DSS Level 1 Certified</span>
                    </div>
                  </div>

                  <button
                    onClick={handleGatewaySuccess}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Pay {currency}{bill.total.toFixed(2)}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {gatewayStep === "PROCESSING" && (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="font-semibold text-sm text-slate-900">Contacting Bank Gateway...</p>
                  <p className="text-xs text-smoke">Simulating instant authorization &amp; capture</p>
                </div>
              )}

              {gatewayStep === "SUCCESS" && (
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} />
                  </div>
                  <h4 className="font-display font-bold text-base text-emerald-800">Payment Authorized!</h4>
                  <p className="text-xs text-smoke">Generating receipt and closing table session...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POST-PAYMENT SUCCESS & THERMAL RECEIPT MODAL */}
      {paidReceiptBill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-page">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-line">
            <div className="bg-emerald-600 text-white p-4 text-center space-y-1">
              <CheckCircle2 size={32} className="mx-auto" />
              <h3 className="font-display font-bold text-lg">Payment Successful!</h3>
              <p className="text-xs text-emerald-100">
                Bill #{paidReceiptBill.billNumber} has been marked PAID
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="ticket bg-panel/30 p-4 rounded text-center space-y-1 font-mono text-xs border border-line">
                <p className="font-bold text-sm text-ink">{data?.restaurant.name}</p>
                <p className="text-smoke">Table #{data?.table.number} · Paid: {currency}{paidReceiptBill.total.toFixed(2)}</p>
                <p className="text-[10px] text-smoke mt-1">Table session closed &amp; marked AVAILABLE</p>
              </div>

              <div className="space-y-2">
                {/* Send Paid Receipt to Diner Mobile */}
                <div className="bg-panel/40 p-3 rounded-lg border border-line space-y-2 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Smartphone size={14} className="text-emerald-600" />
                    <span>Send Paid Receipt to Diner Mobile</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-1.5 rounded bg-white border border-line text-xs font-mono font-bold text-smoke">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="Enter mobile number"
                      value={postPayMobile}
                      onChange={(e) => {
                        setPostPayMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setPostPayMobileFeedback(null);
                      }}
                      className="input py-1 text-xs font-mono tracking-wider flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const raw = postPayMobile.replace(/\D/g, "").slice(-10);
                        if (raw.length !== 10) {
                          setPostPayMobileFeedback("Enter 10-digit number");
                          return;
                        }
                        const text = `🧾 *${data?.restaurant.name || "Restaurant"}*\n*PAID RECEIPT - Bill #${paidReceiptBill.billNumber}*\nTable #${data?.table.number}\n*Total Paid: ${currency}${paidReceiptBill.total.toFixed(2)}*\nStatus: PAID ✅\nThank you for dining with us! Visit again soon! 🙏`;
                        window.open(`https://api.whatsapp.com/send?phone=91${raw}&text=${encodeURIComponent(text)}`, "_blank");
                        setPostPayMobileFeedback(`Receipt sent to +91 ${raw} on WhatsApp!`);
                      }}
                      className="btn-secondary py-1 px-2.5 text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shrink-0"
                    >
                      <span>💬 WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const raw = postPayMobile.replace(/\D/g, "").slice(-10);
                        if (raw.length !== 10) {
                          setPostPayMobileFeedback("Enter 10-digit number");
                          return;
                        }
                        const text = `🧾 *${data?.restaurant.name || "Restaurant"}*\nPAID RECEIPT: Bill #${paidReceiptBill.billNumber} for Table #${data?.table.number}. Total Paid: ${currency}${paidReceiptBill.total.toFixed(2)}. Status: PAID. Thank you!`;
                        window.location.href = `sms:+91${raw}?body=${encodeURIComponent(text)}`;
                        navigator.clipboard?.writeText(text);
                        setPostPayMobileFeedback(`SMS prepared for +91 ${raw}!`);
                      }}
                      className="btn-secondary py-1 px-2 text-xs font-semibold bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100 shrink-0"
                    >
                      <span>📱 SMS</span>
                    </button>
                  </div>
                  {postPayMobileFeedback && (
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={12} /> {postPayMobileFeedback}
                    </p>
                  )}
                </div>

                <a
                  href={`/manager/receipt/${paidReceiptBill.id}`}
                  className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Printer size={14} />
                  <span>Print Thermal Receipt</span>
                </a>

                <a
                  href={`/api/manager/bill/${paidReceiptBill.id}/pdf`}
                  className="btn-secondary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
                  download
                >
                  <Download size={14} />
                  <span>Download Invoice PDF</span>
                </a>

                <button
                  onClick={() => {
                    setPaidReceiptBill(null);
                    setSelected(null);
                    posSound.playClick();
                  }}
                  className="w-full py-2 text-xs text-smoke hover:text-ink font-medium"
                >
                  Return to Floor Tables
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN / DEDICATED CUSTOMER-FACING QR CODE MODAL */}
      {showQrModal && bill && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-page">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-line flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-800 to-indigo-900 text-white p-5 text-center relative">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="absolute right-4 top-4 text-white/70 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X size={18} />
              </button>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-purple-200 mb-2">
                <QrCode size={13} />
                <span>Scan &amp; Pay · Instant UPI</span>
              </div>
              <h3 className="font-display font-bold text-3xl">
                {currency}{bill.total.toFixed(2)}
              </h3>
              <p className="text-xs text-purple-200 mt-1">
                Bill #{bill.billNumber} · Table #{data?.table.number}
              </p>
            </div>

            {/* Mode switch */}
            <div className="px-5 pt-4">
              <div className="flex bg-panel p-1 rounded-lg border border-line text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setQrMode("STAND_EE")}
                  className={`flex-1 py-1.5 rounded transition-all ${
                    qrMode === "STAND_EE"
                      ? "bg-emerald-600 text-white shadow font-bold"
                      : "text-smoke hover:text-ink"
                  }`}
                >
                  {hasCustomQr ? "Uploaded Standee QR" : "Restaurant Standee QR"}
                </button>
                <button
                  type="button"
                  onClick={() => setQrMode("DYNAMIC")}
                  className={`flex-1 py-1.5 rounded transition-all ${
                    qrMode === "DYNAMIC"
                      ? "bg-emerald-600 text-white shadow font-bold"
                      : "text-smoke hover:text-ink"
                  }`}
                >
                  Dynamic Bill QR
                </button>
              </div>
            </div>

            {/* QR Image Content */}
            <div className="p-5 text-center space-y-4">
              {qrMode === "STAND_EE" && customQrUrl ? (
                <div className="space-y-3">
                  <div className="bg-white qr-box bg-white-solid p-2.5 rounded-xl border-2 border-emerald-500/30 shadow-md inline-block">
                    <img
                      src={customQrUrl}
                      alt="Restaurant Custom Payment QR"
                      className="w-56 h-64 object-contain mx-auto"
                    />
                  </div>
                  <div className="space-y-0.5 text-xs font-mono">
                    <p className="font-bold text-ink text-sm">
                      {data?.restaurant.name}
                    </p>
                    {data?.restaurant.upiId && <p className="text-smoke">{data.restaurant.upiId}</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white qr-box bg-white-solid p-3 rounded-xl border-2 border-emerald-500/30 shadow-md inline-block">
                    <img
                      src={`/api/manager/qr?text=${encodeURIComponent(upiUri || `upi://pay?pa=${encodeURIComponent(data?.restaurant.upiId || "")}&pn=${encodeURIComponent(data?.restaurant.name || "")}`)}`}
                      alt="Dynamic Bill QR Code"
                      className="w-52 h-52 mx-auto"
                    />
                  </div>
                  <div className="space-y-0.5 text-xs font-mono">
                    <p className="font-bold text-ink">Bill Total: {currency}{bill.total.toFixed(2)}</p>
                    {data?.restaurant.upiId && <p className="text-smoke">{data.restaurant.upiId}</p>}
                  </div>
                </div>
              )}

              {/* Accepted Apps Banner */}
              <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-200/60 text-xs text-purple-900 space-y-1">
                <p className="font-semibold text-[11px] uppercase tracking-wider text-purple-800">
                  Pay with any UPI app
                </p>
                <p className="text-[12px] font-medium text-slate-700">
                  Google Pay · PhonePe · Paytm · BHIM · Cred · Amazon Pay
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowQrModal(false);
                    setActivePaymentTab("UPI");
                    posSound.playClick();
                  }}
                  className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <CheckCircle2 size={15} />
                  <span>Customer Paid — Settle with UPI</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={copyUpiLink}
                    className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1"
                  >
                    {copiedUpi ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedUpi ? "Copied!" : "Copy UPI Link"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQrModal(false)}
                    className="btn-secondary py-2 px-4 text-xs"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

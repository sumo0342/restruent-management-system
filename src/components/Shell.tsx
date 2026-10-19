"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  LayoutDashboard,
  Users,
  UtensilsCrossed,
  LayoutGrid,
  ClipboardList,
  BarChart3,
  StickyNote,
  Wrench,
  Settings,
  ScrollText,
  Receipt,
  Clock,
  History,
  Building2,
  CalendarDays,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { Avatar } from "@/components/Avatar";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

// Icon components can't be passed as props from a Server Component (they're
// functions, not serializable data) — so instead of building this array in
// each role's server layout.tsx and passing it in, every role's nav lives
// here, inside the client component that actually renders the icons.
const NAV_BY_ROLE = {
  owner: [
    { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/owner/orders", label: "Orders", icon: ClipboardList },
    { href: "/owner/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/owner/menu", label: "Menu", icon: UtensilsCrossed },
    { href: "/owner/tables", label: "Tables", icon: LayoutGrid },
    { href: "/owner/branches", label: "Branches", icon: Building2 },
    { href: "/owner/users", label: "Users", icon: Users },
    { href: "/owner/reports", label: "Reports", icon: BarChart3 },
    { href: "/owner/notes", label: "Notes", icon: StickyNote },
    { href: "/owner/maintenance", label: "Maintenance", icon: Wrench },
    { href: "/owner/audit-logs", label: "Audit log", icon: ScrollText },
    { href: "/owner/settings", label: "Settings", icon: Settings },
  ],
  manager: [
    { href: "/manager/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/manager/billing", label: "Billing", icon: Receipt },
    { href: "/manager/bookings", label: "Bookings", icon: CalendarDays },
    { href: "/manager/payments", label: "Payments", icon: History },
    { href: "/manager/shifts", label: "Shift", icon: Clock },
  ],
  waiter: [
    { href: "/waiter/tables", label: "Tables", icon: LayoutGrid },
    { href: "/waiter/bookings", label: "Reservations", icon: CalendarDays },
    { href: "/waiter/orders", label: "My orders", icon: ClipboardList },
  ],
} satisfies Record<string, NavItem[]>;

export type ShellRole = keyof typeof NAV_BY_ROLE;

export function Shell({
  children,
  role,
  roleLabel,
  userName,
}: {
  children: React.ReactNode;
  role: ShellRole;
  roleLabel: string;
  userName: string;
}) {
  const pathname = usePathname();
  const nav = NAV_BY_ROLE[role];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-transparent relative">
      {/* Desktop sidebar — frosted deep forest glass rail with specular off-white rim */}
      <aside className="print:hidden hidden md:flex md:w-64 md:flex-col bg-[rgba(9,27,21,0.92)] backdrop-blur-xl border-r border-white/10 px-4 py-6 relative overflow-hidden shrink-0 z-30 shadow-[4px_0_30px_rgba(0,0,0,0.45)]">
        <div className="absolute -top-12 -left-12 w-36 h-36 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-16 w-32 h-32 rounded-full bg-emerald-700/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-8 px-2 relative z-10">
          <span className="brand-mark shrink-0">
            <UtensilsCrossed size={20} className="text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-bold leading-tight text-white tracking-wide truncate">Spice Route</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">{roleLabel}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5 relative z-10">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-rail-item flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "is-active font-semibold"
                    : "text-slate-300/80 hover:text-white hover:bg-white/[0.08]"
                }`}
              >
                <Icon size={17} className={active ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "text-slate-400"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 pt-4 mt-4 relative z-10">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
            <Avatar name={userName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-[#FAF8F5]">{userName}</p>
              <p className="text-[10px] text-emerald-300/70 capitalize">{role}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button className="mt-2.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300/80 hover:text-white hover:bg-white/[0.08] border border-transparent hover:border-white/10 transition-all">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar — frosted deep forest glass */}
      <header className="print:hidden md:hidden flex items-center justify-between bg-[rgba(9,27,21,0.92)] backdrop-blur-xl border-b border-white/10 px-4 py-3 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-2.5">
          <span className="brand-mark shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
            <UtensilsCrossed size={16} className="text-white" strokeWidth={2.25} />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-tight text-white">Spice Route</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300/80">{roleLabel}</p>
          </div>
        </div>
        <form action={logoutAction} className="flex items-center gap-3">
          <Avatar name={userName} size="sm" />
          <button className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <LogOut size={18} />
          </button>
        </form>
      </header>

      <main key={pathname} className="flex-1 pb-20 md:pb-0 overflow-x-hidden animate-page relative z-10">{children}</main>

      {/* Mobile bottom nav — frosted glass floating dock */}
      <nav
        className="print:hidden md:hidden fixed bottom-0 inset-x-0 z-30 bg-[rgba(9,27,21,0.94)] backdrop-blur-2xl border-t border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] grid"
        style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}
      >
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-all ${
                active
                  ? "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={18} />
              <span className="truncate max-w-[60px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

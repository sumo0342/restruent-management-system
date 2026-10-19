import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "KITCHEN" && user.role !== "OWNER") redirect("/login");

  return (
    <div className="min-h-screen bg-transparent text-slate-100 relative">
      <header className="flex items-center justify-between px-6 py-4 bg-[rgba(11,15,26,0.82)] backdrop-blur-xl border-b border-white/10 sticky top-0 z-30 shadow-lg">
        <div>
          <p className="font-display text-xl font-bold text-white tracking-wide">Kitchen Display</p>
          <p className="text-xs text-slate-400 font-medium">{user.name}</p>
        </div>
        <form action={logoutAction}>
          <button className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
            Log out
          </button>
        </form>
      </header>
      <div className="animate-page relative z-10">{children}</div>
    </div>
  );
}

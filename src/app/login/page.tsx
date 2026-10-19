import { redirect } from "next/navigation";
import { UtensilsCrossed, ShieldCheck, Zap, Sparkles } from "lucide-react";
import { getCurrentUser, ROLE_HOME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";
import { StickerImage, StickerBadge } from "@/components/Sticker";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME[user.role]);

  // Single-restaurant deployment
  const branches = await prisma.branch.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="min-h-screen flex selection:bg-emerald-500/40 selection:text-white">
      {/* Hero panel — deep forest green botanical scene with playful restaurant stickers */}
      <div className="login-scene hidden lg:flex lg:w-[48%] xl:w-[44%] relative flex-col justify-between p-10 xl:p-12 text-[#FAF8F5]">
        <div className="login-grain" aria-hidden="true" />

        {/* Ambient subtle decorative lights */}
        <div
          aria-hidden="true"
          className="absolute top-1/4 right-0 w-80 h-80 rounded-full opacity-35 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.3), transparent 70%)" }}
        />

        <div className="relative z-10 animate-page">
          <div className="flex items-center gap-3">
            <div className="brand-mark">
              <UtensilsCrossed size={22} className="text-white" strokeWidth={2.25} />
            </div>
            <StickerBadge text="Farm to Fork" icon="🌿" variant="deepGreen" tilt="slight-right" />
          </div>

          <h1 className="font-display text-4xl xl:text-5xl mt-6 leading-tight font-extrabold text-white">
            Spice Route
            <br />
            <span className="text-emerald-400">Kitchen</span>
          </h1>
          <p className="text-emerald-100/70 text-sm mt-3 max-w-sm font-medium">
            One harmonious floor system — live table orders, the kitchen line, billing,
            and bookkeeping in sync in real time.
          </p>

          {/* Interactive Die-cut Sticker Showcase */}
          <div className="mt-8 flex items-end gap-4 p-4 rounded-3xl bg-white/[0.04] border border-white/10 backdrop-blur-xl max-w-md shadow-2xl">
            <div className="shrink-0">
              <StickerImage
                type="chef"
                size="md"
                tilt="left"
                caption="Chef Curated"
              />
            </div>
            <div className="shrink-0 -ml-2 mb-2">
              <StickerImage
                type="food"
                size="sm"
                tilt="right"
                caption="Fresh Hot"
              />
            </div>
            <div className="shrink-0 -ml-2">
              <StickerImage
                type="badge"
                size="sm"
                tilt="slight-left"
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-4 animate-page my-6" style={{ animationDelay: "80ms" }}>
          <Feature
            icon={Zap}
            title="Live, floor to kitchen sync"
            body="A ticket sent from the table floor reaches the chef line in milliseconds — and comes back hot and ready."
          />
          <Feature
            icon={ShieldCheck}
            title="Role-tailored operations"
            body="Owner, manager, kitchen, and waiter each see exactly what their shift needs."
          />
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-emerald-100/40 animate-page" style={{ animationDelay: "140ms" }}>
          <p>© {new Date().getFullYear()} Spice Route Kitchen</p>
          <span className="inline-flex items-center gap-1.5 text-emerald-400/80 font-medium">
            <Sparkles size={13} /> Deep Green Edition
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-transparent px-4 py-12 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-35 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.22), transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%)" }}
        />

        <div className="w-full max-w-sm relative z-10 animate-page">
          {/* Mobile view branding with cute sticker */}
          <div className="text-center mb-8 lg:hidden">
            <div className="flex justify-center mb-3">
              <StickerImage type="chef" size="sm" tilt="slight-right" />
            </div>
            <p className="font-display text-3xl font-extrabold text-[#FAF8F5]">Spice Route Kitchen</p>
            <p className="text-emerald-300/70 text-sm mt-1 font-medium">Restaurant sign-in</p>
          </div>

          <div className="hidden lg:flex items-center justify-between mb-6">
            <div>
              <p className="font-display text-2xl font-bold text-[#FAF8F5]">Sign in</p>
              <p className="text-slate-300/70 text-sm mt-1">Enter your restaurant credentials.</p>
            </div>
            <StickerBadge text="Live Floor" icon="⚡" variant="offWhite" tilt="slight-right" />
          </div>

          <div className="glass-panel p-7 shadow-2xl">
            <LoginForm branches={branches} />
          </div>

          <details className="mt-6 text-xs text-slate-300/70 text-center group">
            <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 hover:text-white transition-colors font-medium">
              Demo accounts
              <span className="transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3 text-left inline-grid gap-2 card-lift p-4 bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-xl">
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-amber-400 mb-0.5">Owner tab</p>
                <p className="text-slate-200">owner@restaurant.com <span className="text-slate-500">/</span> Owner@123</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-0.5">Staff tab — Main Street</p>
                <p className="text-slate-200">manager@restaurant.com <span className="text-slate-500">/</span> Manager@123</p>
                <p className="text-slate-200">chef@restaurant.com <span className="text-slate-500">/</span> Chef@123</p>
                <p className="text-slate-200">waiter1@restaurant.com <span className="text-slate-500">/</span> Waiter@123</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 mb-0.5">Staff tab — Riverside</p>
                <p className="text-slate-200">manager2@restaurant.com <span className="text-slate-500">/</span> Manager@123</p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Zap;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3.5 items-start">
      <div className="mt-0.5 w-9 h-9 bg-emerald-500/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-emerald-400/25 rounded-xl shadow-sm">
        <Icon size={16} className="text-emerald-300" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/95">{title}</p>
        <p className="text-xs text-emerald-100/60 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

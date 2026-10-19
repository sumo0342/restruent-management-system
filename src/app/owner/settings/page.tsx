import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSettingsAction } from "@/lib/actions/owner";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { OwnerQrManager } from "./OwnerQrManager";
import { QrCode, Sparkles, Building2 } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const restaurant = await prisma.restaurant.findUnique({ where: { id: user!.restaurantId } });
  if (!restaurant) return null;

  return (
    <div className="p-4 md:p-8 max-w-xl space-y-8 animate-page">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Restaurant Settings</h1>
        <p className="text-smoke text-sm">Restaurant profile, tax, UPI payments &amp; security credentials.</p>
      </div>

      {/* RESTAURANT INFO & FINANCIALS */}
      <form action={updateSettingsAction} className="card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <div className="p-2 rounded bg-flame/10 text-flame">
            <Building2 size={18} />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-ink">Profile &amp; Invoicing</h2>
            <p className="text-xs text-smoke">General business details printed on customer bills.</p>
          </div>
        </div>

        <div>
          <label className="label">Restaurant name</label>
          <input name="name" defaultValue={restaurant.name} required className="input" />
        </div>
        <div>
          <label className="label">Address</label>
          <input name="address" defaultValue={restaurant.address ?? ""} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={restaurant.phone ?? ""} className="input" />
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input name="gstin" defaultValue={restaurant.gstin ?? ""} className="input" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tax %</label>
            <input name="taxPercent" type="number" step="0.01" defaultValue={restaurant.taxPercent} className="input" />
          </div>
          <div>
            <label className="label">Service charge %</label>
            <input name="serviceChargePercent" type="number" step="0.01" defaultValue={restaurant.serviceChargePercent} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Invoice footer note</label>
          <textarea name="invoiceFooter" defaultValue={restaurant.invoiceFooter ?? ""} className="input" rows={2} placeholder="Thank you, visit again!" />
        </div>

        {/* RESTAURANT UPI VPA SETTINGS */}
        <div className="border-t border-line pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-smoke uppercase tracking-wider flex items-center gap-1.5">
              <QrCode size={15} className="text-emerald-400" />
              <span>Restaurant UPI Payment ID (VPA)</span>
            </label>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Auto-Generated QR
            </span>
          </div>

          <div>
            <label className="label">UPI ID / VPA</label>
            <input
              name="upiId"
              defaultValue={restaurant.upiId ?? ""}
              className="input font-mono text-xs font-semibold"
              placeholder="e.g. restaurant@okhdfcbank, merchant@paytm"
            />
            <p className="text-[11px] text-smoke mt-1">
              Used to generate dynamic UPI QR codes with exact bill amounts on customer receipts, thermal printouts, and digital terminal.
            </p>
          </div>
        </div>

        <button className="btn-primary w-full py-2.5 text-xs font-semibold">Save Profile &amp; Financials</button>
      </form>

      {/* UPLOAD & MANAGE CUSTOM PAYMENT QR CODE */}
      <OwnerQrManager initialUpiId={restaurant.upiId} restaurantName={restaurant.name} />

      {/* CHANGE / SET OWNER PASSWORD */}
      <ChangePasswordForm />
    </div>
  );
}


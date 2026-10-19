"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  changeOwnerPasswordAction,
  setOwnerPasswordDirectAction,
  type PasswordChangeState,
} from "@/lib/actions/owner";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, Sparkles, KeyRound } from "lucide-react";

const initialState: PasswordChangeState = {};

function SubmitBtn({ isDirect }: { isDirect: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg"
    >
      <ShieldCheck size={14} />
      <span>{pending ? "Updating Master Password..." : isDirect ? "Set New Owner Password" : "Confirm & Update Password"}</span>
    </button>
  );
}

export function ChangePasswordForm() {
  const [mode, setMode] = useState<"DIRECT" | "VERIFY_OLD">("DIRECT");
  const [directState, directFormAction] = useFormState(setOwnerPasswordDirectAction, initialState);
  const [verifyState, verifyFormAction] = useFormState(changeOwnerPasswordAction, initialState);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [genNotice, setGenNotice] = useState<string | null>(null);

  const activeState = mode === "DIRECT" ? directState : verifyState;
  const activeAction = mode === "DIRECT" ? directFormAction : verifyFormAction;

  const handleGeneratePassword = () => {
    const prefixes = ["Owner", "Master", "Safe", "Crown", "Prime", "Apex"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const generated = `${prefix}#${randomDigits}`;

    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNew(true);
    setShowConfirm(true);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(generated);
      setGenNotice(`Generated "${generated}" & copied to clipboard!`);
    } else {
      setGenNotice(`Generated "${generated}"`);
    }

    setTimeout(() => setGenNotice(null), 5000);
  };

  const calculateStrength = (pwd: string) => {
    if (!pwd) return { label: "", percent: 0, color: "bg-slate-700" };
    if (pwd.length < 8) return { label: "Too short (min 8 chars)", percent: 25, color: "bg-rose-500" };
    const hasNum = /\d/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);

    const score = (hasNum ? 1 : 0) + (hasSpecial ? 1 : 0) + (hasUpper ? 1 : 0);
    if (score >= 2 && pwd.length >= 8) {
      return { label: "Strong Master Password", percent: 100, color: "bg-emerald-500" };
    }
    return { label: "Moderate Password", percent: 65, color: "bg-amber-500" };
  };

  const strength = calculateStrength(newPassword);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Lock size={18} />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Owner Security &amp; Password</h2>
            <p className="text-xs text-slate-400">Set or change the master administrative password for this account.</p>
          </div>
        </div>

        <div className="flex bg-black/40 border border-white/10 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("DIRECT")}
            className={`px-3 py-1 rounded font-semibold transition-all ${
              mode === "DIRECT"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Direct Set New Password
          </button>
          <button
            type="button"
            onClick={() => setMode("VERIFY_OLD")}
            className={`px-3 py-1 rounded font-semibold transition-all ${
              mode === "VERIFY_OLD"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Verify Old Password
          </button>
        </div>
      </div>

      {activeState.success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-toast">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>Master owner password updated successfully! Keep your new credentials confidential.</span>
        </div>
      )}

      {activeState.error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-toast">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{activeState.error}</span>
        </div>
      )}

      {genNotice && (
        <div className="p-3 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs flex items-center gap-2 animate-toast">
          <Sparkles size={14} className="text-teal-400 shrink-0" />
          <span>{genNotice}</span>
        </div>
      )}

      <form action={activeAction} className="space-y-4">
        {mode === "VERIFY_OLD" && (
          <div>
            <label className="label" htmlFor="currentPassword">
              Current Password
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter current master password"
                className="input pr-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-smoke hover:text-white"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label !mb-0" htmlFor="newPassword">
              New Master Password (min 8 chars)
            </label>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
            >
              <Sparkles size={12} />
              <span>⚡ Auto-Generate Strong Password</span>
            </button>
          </div>

          <div className="relative">
            <input
              id="newPassword"
              name="newPassword"
              type={showNew ? "text" : "password"}
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Enter new strong master password"
              className="input pr-9"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-smoke hover:text-white"
            >
              {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Strength bar */}
          {newPassword && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${strength.color}`}
                  style={{ width: `${strength.percent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400">{strength.label}</p>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="confirmPassword">
            Confirm New Master Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? "text" : "password"}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter new master password"
              className="input pr-9"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-smoke hover:text-white"
            >
              {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <SubmitBtn isDirect={mode === "DIRECT"} />
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  requestPasswordResetOtpAction,
  verifyAndSetNewPasswordAction,
  forgotPasswordAction,
} from "@/app/login/actions";
import {
  KeyRound,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  RefreshCw,
  BellRing,
  Lock,
} from "lucide-react";

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Incoming Realtime SMS Alert state
  const [incomingSms, setIncomingSms] = useState<{
    code: string;
    target: string;
  } | null>(null);

  const playSmsChime = () => {
    try {
      if (typeof window !== "undefined" && window.AudioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio not permitted
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = identifier.trim();
    if (!val) {
      setError("Please enter your registered email address or mobile phone number.");
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await requestPasswordResetOtpAction(val);
      if (!res.ok || !res.challengeId) {
        setError(res.error || "Could not find account. Please verify credentials.");
        return;
      }

      setChallengeId(res.challengeId);
      setOtp("");

      if (res.devOtp) {
        playSmsChime();
        setIncomingSms({
          code: res.devOtp,
          target: res.destination || val,
        });
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send reset code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!challengeId || otp.trim().length !== 6) {
      setError("Please enter the 6-digit OTP code received.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsResetting(true);
      const res = await verifyAndSetNewPasswordAction(challengeId, otp.trim(), newPassword);
      if (res && !res.ok) {
        setError(res.error || "Failed to reset password.");
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setError(err?.message || "Failed to update password.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleGeneratePassword = () => {
    const prefixes = ["Master", "Owner", "Safe", "Star", "Prime"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const generated = `${prefix}#${randomDigits}`;

    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setShowConfirm(true);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(generated);
    }
  };

  return (
    <>
      {/* REALTIME INCOMING OTP BANNER */}
      {incomingSms && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-toast">
          <div className="p-3.5 rounded-2xl bg-slate-950/90 text-white border border-emerald-500/40 shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.3)] backdrop-blur-xl flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <BellRing size={17} className="animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Realtime SMS OTP
                </span>
                <span className="text-[10px] text-slate-400">Just now</span>
              </div>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">Password Reset Security Code</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-base font-extrabold tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  {incomingSms.code}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOtp(incomingSms.code);
                    setIncomingSms(null);
                  }}
                  className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow"
                >
                  <Sparkles size={12} />
                  <span>Auto-Fill</span>
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIncomingSms(null)}
              className="text-slate-400 hover:text-white p-1 rounded transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 backdrop-blur-md animate-toast">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!challengeId ? (
          /* STEP 1: ENTER EMAIL OR PHONE NUMBER */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="label" htmlFor="identifier">
                Account Email or 10-Digit Mobile Number
              </label>
              <input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. owner@restaurant.com or 9876543210"
                className="input"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                We'll dispatch a 6-digit real-time verification OTP to authorize setting your new password.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSendingOtp || !identifier.trim()}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg"
            >
              {isSendingOtp ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Sending Realtime OTP...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Send Realtime Verification OTP</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: ENTER OTP & NEW PASSWORD */
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <span>Code sent for: <strong>{identifier}</strong></span>
              <button
                type="button"
                onClick={() => setChallengeId(null)}
                className="text-[11px] text-emerald-400 underline hover:text-emerald-300"
              >
                Change
              </button>
            </div>

            <div>
              <label className="label text-center block" htmlFor="resetOtp">
                Enter 6-Digit Realtime OTP
              </label>
              <input
                id="resetOtp"
                type="text"
                required
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="input text-center text-2xl font-mono tracking-[0.45em] py-2.5 text-white font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0" htmlFor="newPassword">
                  New Master Password (min 8 chars)
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                >
                  <Sparkles size={12} />
                  <span>⚡ Auto-Generate</span>
                </button>
              </div>

              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-smoke hover:text-white"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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

            <button
              type="submit"
              disabled={isResetting || otp.length !== 6 || newPassword.length < 8}
              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg"
            >
              {isResetting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Verify OTP &amp; Set New Password</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link
            href="/login"
            className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Return to Login</span>
          </Link>
        </div>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import {
  loginAction,
  verifyOwnerOtpAction,
  resendOwnerOtpAction,
  requestPhoneOtpAction,
  verifyPhoneOtpAction,
  type LoginState,
} from "./actions";
import {
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  RefreshCw,
  Smartphone,
  Mail,
  Sparkles,
  ArrowRight,
  BellRing,
} from "lucide-react";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-2.5 text-sm font-bold shadow-lg">
      {pending ? "Authenticating..." : "Sign in"}
    </button>
  );
}

export function LoginForm({ branches }: { branches: { id: string; name: string }[] }) {
  const [authMethod, setAuthMethod] = useState<"PASSWORD" | "PHONE_OTP">("PASSWORD");
  const [tab, setTab] = useState<"STAFF" | "OWNER">("STAFF");
  const [selectedBranchId, setSelectedBranchId] = useState("");

  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get("reset") === "success";

  // Password / standard form state
  const [state, formAction] = useFormState(loginAction, initialState);

  // Realtime Phone OTP state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneChallengeId, setPhoneChallengeId] = useState<string | null>(null);
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Incoming Realtime SMS Alert Banner state
  const [incomingSms, setIncomingSms] = useState<{
    code: string;
    target: string;
    title: string;
  } | null>(null);

  // Owner 2FA OTP Modal state (for password login)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState("");
  const [activeDevOtp, setActiveDevOtp] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Sound effect simulation for incoming realtime OTP
  const playSmsChime = () => {
    try {
      if (typeof window !== "undefined" && window.AudioContext) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio not permitted or supported
    }
  };

  // When server responds with requiresOtp from password login
  useEffect(() => {
    if (state.requiresOtp && state.challengeId) {
      setShowOtpModal(true);
      setActiveDevOtp(state.devOtp || null);
      setOtpError(null);
      setEnteredOtp("");

      if (state.devOtp) {
        playSmsChime();
        setIncomingSms({
          code: state.devOtp,
          target: state.destination || "Owner Account",
          title: "Owner 2FA Safety OTP",
        });
      }
    }
  }, [state]);

  // Request Realtime Phone OTP
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);

    const clean = phoneNumber.replace(/\D/g, "").slice(-10);
    if (clean.length !== 10) {
      setPhoneError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (tab === "STAFF" && branches.length > 0 && !selectedBranchId) {
      setPhoneError("Please select your branch before requesting OTP.");
      return;
    }

    try {
      setIsSendingPhoneOtp(true);
      const res = await requestPhoneOtpAction(clean, tab, selectedBranchId);

      if (!res.ok || !res.challengeId) {
        setPhoneError(res.error || "Failed to dispatch OTP. Please verify details.");
        return;
      }

      setPhoneChallengeId(res.challengeId);
      setPhoneOtp("");

      if (res.devOtp) {
        playSmsChime();
        setIncomingSms({
          code: res.devOtp,
          target: `+91 ${clean}`,
          title: `Realtime Login OTP for ${res.userName || tab}`,
        });
      }
    } catch (err: any) {
      setPhoneError(err?.message || "Failed to send OTP.");
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  // Verify Phone OTP
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneChallengeId || phoneOtp.trim().length !== 6) {
      setPhoneError("Please enter the complete 6-digit OTP.");
      return;
    }

    try {
      setIsVerifyingPhoneOtp(true);
      setPhoneError(null);
      const res = await verifyPhoneOtpAction(phoneChallengeId, phoneOtp.trim());
      if (res && !res.ok) {
        setPhoneError(res.error || "Incorrect OTP code.");
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setPhoneError(err?.message || "Failed to verify OTP.");
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  // Verify Owner 2FA OTP (Password flow)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.challengeId || enteredOtp.trim().length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP.");
      return;
    }

    try {
      setIsVerifying(true);
      setOtpError(null);
      const res = await verifyOwnerOtpAction(state.challengeId, enteredOtp);
      if (res?.error) {
        setOtpError(res.error);
      }
    } catch (err: any) {
      if (err?.message?.includes("NEXT_REDIRECT")) return;
      setOtpError(err?.message || "Failed to verify OTP.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!state.challengeId) return;
    try {
      setIsResending(true);
      setOtpError(null);
      const res = await resendOwnerOtpAction(state.challengeId);
      if (res?.devOtp) {
        setActiveDevOtp(res.devOtp);
        playSmsChime();
        setIncomingSms({
          code: res.devOtp,
          target: state.destination || "Owner Account",
          title: "New Owner 2FA OTP Dispatched",
        });
      }
    } catch {
      setOtpError("Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  const autoFillOtp = (code: string) => {
    if (authMethod === "PHONE_OTP") {
      setPhoneOtp(code);
    } else {
      setEnteredOtp(code);
    }
    setIncomingSms(null);
  };

  return (
    <>
      {/* REALTIME INCOMING SMS NOTIFICATION BANNER */}
      {incomingSms && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-toast">
          <div className="p-3.5 rounded-2xl bg-slate-950/90 text-white border border-emerald-500/40 shadow-[0_12px_36px_rgba(0,0,0,0.6),0_0_24px_rgba(16,185,129,0.3)] backdrop-blur-xl flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <BellRing size={17} className="animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Realtime SMS Alert
                </span>
                <span className="text-[10px] text-slate-400">Just now</span>
              </div>
              <p className="text-xs font-semibold text-slate-200 mt-0.5">{incomingSms.title}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-base font-extrabold tracking-widest text-emerald-300 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                  {incomingSms.code}
                </span>
                <button
                  type="button"
                  onClick={() => autoFillOtp(incomingSms.code)}
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
        {resetSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 backdrop-blur-md animate-toast">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>Password updated successfully! Please sign in with your new credentials.</span>
          </div>
        )}

        {/* AUTH METHOD SELECTOR */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 border border-white/10 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setAuthMethod("PASSWORD");
              setPhoneError(null);
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              authMethod === "PASSWORD"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Mail size={13} />
            <span>Email &amp; Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("PHONE_OTP");
              setPhoneError(null);
            }}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              authMethod === "PHONE_OTP"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Smartphone size={13} />
            <span>Phone Number OTP</span>
          </button>
        </div>

        {/* ROLE TABS */}
        <div className="flex gap-1.5 p-1.5 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setTab("STAFF")}
            className={`role-tab ${tab === "STAFF" ? "is-active" : ""}`}
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => setTab("OWNER")}
            className={`role-tab ${tab === "OWNER" ? "is-active" : ""}`}
          >
            Owner
          </button>
        </div>

        <p className="text-xs text-slate-400 -mt-1 leading-relaxed">
          {tab === "STAFF"
            ? "Manager, kitchen and waiter accounts sign in here."
            : "Restaurant owner administrative access with real-time OTP protection."}
        </p>

        {/* BRANCH PICKER FOR STAFF */}
        {tab === "STAFF" && branches.length > 0 && (
          <div>
            <label className="label" htmlFor="branchPicker">Branch</label>
            <select
              id="branchPicker"
              name="branchId"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              required
              className="input"
            >
              <option value="">Select your branch...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value="none">No branch (unassigned staff)</option>
            </select>
          </div>
        )}

        {/* ---------------- METHOD 1: REALTIME PHONE NUMBER OTP ---------------- */}
        {authMethod === "PHONE_OTP" ? (
          <div className="space-y-4">
            {!phoneChallengeId ? (
              <form onSubmit={handleSendPhoneOtp} className="space-y-4">
                <div>
                  <label className="label" htmlFor="phoneInput">
                    Mobile Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="input !w-16 text-center font-mono text-xs font-bold text-slate-300 bg-white/5 shrink-0 py-2.5">
                      +91
                    </span>
                    <input
                      id="phoneInput"
                      type="tel"
                      required
                      maxLength={10}
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="98765 43210"
                      className="input font-mono tracking-wider text-sm flex-1"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter your 10-digit mobile number. A 6-digit realtime OTP will be sent immediately.
                  </p>
                </div>

                {phoneError && (
                  <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 rounded-xl backdrop-blur-md animate-toast">
                    {phoneError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSendingPhoneOtp || phoneNumber.length !== 10}
                  className="btn-primary w-full py-2.5 text-sm font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  <Smartphone size={15} />
                  <span>{isSendingPhoneOtp ? "Sending Realtime OTP..." : "Send Realtime OTP"}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhoneOtp} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
                  <span>OTP dispatched to: <strong>+91 {phoneNumber}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneChallengeId(null);
                      setPhoneOtp("");
                    }}
                    className="text-[11px] text-emerald-400 underline hover:text-emerald-300"
                  >
                    Change Number
                  </button>
                </div>

                <div>
                  <label className="label text-center block" htmlFor="phoneOtpInput">
                    Enter 6-Digit Realtime OTP
                  </label>
                  <input
                    id="phoneOtpInput"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    className="input text-center text-2xl font-mono tracking-[0.45em] py-3 text-white font-bold placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600"
                  />
                </div>

                {phoneError && (
                  <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 rounded-xl backdrop-blur-md animate-toast">
                    {phoneError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingPhoneOtp || phoneOtp.length !== 6}
                  className="btn-primary w-full py-2.5 text-sm font-bold shadow-lg flex items-center justify-center gap-2"
                >
                  <Lock size={15} />
                  <span>{isVerifyingPhoneOtp ? "Verifying OTP..." : "Verify OTP & Log In"}</span>
                </button>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <button
                    type="button"
                    onClick={handleSendPhoneOtp}
                    disabled={isSendingPhoneOtp}
                    className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={isSendingPhoneOtp ? "animate-spin" : ""} />
                    <span>Resend OTP Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhoneChallengeId(null)}
                    className="hover:text-white"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* ---------------- METHOD 2: EMAIL & PASSWORD ---------------- */
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="intendedRole" value={tab} />
            {selectedBranchId && <input type="hidden" name="branchId" value={selectedBranchId} />}

            <div>
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className="input"
                placeholder="you@restaurant.com"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
              />
            </div>

            {tab === "OWNER" && (
              <div className="flex justify-end items-center text-xs -mt-1">
                <span className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                  <ShieldCheck size={12} />
                  <span>2FA Protected</span>
                </span>
              </div>
            )}

            {state.error && (
              <p className="text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 rounded-xl backdrop-blur-md animate-toast">
                {state.error}
              </p>
            )}

            <SubmitButton />
          </form>
        )}
      </div>

      {/* OWNER 2FA OTP POPUP MODAL (FOR PASSWORD FLOW) */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-page">
          <div className="glass-panel max-w-md w-full p-6 sm:p-7 space-y-5 border border-white/20 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowOtpModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/35 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                <ShieldCheck size={26} />
              </div>
              <h3 className="font-display font-bold text-xl text-white">Owner Security Verification</h3>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Enter the 6-digit real-time one-time password (OTP) sent for owner access.
              </p>
              <p className="text-xs text-orange-400 font-mono font-semibold">
                Sent to: {state.destination}
              </p>
            </div>

            {/* Visual Security OTP Notice with Auto-Fill */}
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <KeyRound size={16} className="text-amber-400 shrink-0" />
                <span>
                  Realtime OTP: <strong className="font-mono text-base text-white tracking-widest">{activeDevOtp}</strong>
                </span>
              </div>
              {activeDevOtp && (
                <button
                  type="button"
                  onClick={() => setEnteredOtp(activeDevOtp)}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                >
                  Fill
                </button>
              )}
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-toast">
                <AlertCircle size={15} className="text-rose-400 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label text-center block text-slate-300">
                  Enter 6-Digit Security OTP
                </label>
                <input
                  type="text"
                  name="otp"
                  required
                  maxLength={6}
                  autoFocus
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="input text-center text-2xl font-mono tracking-[0.45em] py-3 text-white font-bold placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || enteredOtp.length !== 6}
                className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Lock size={15} />
                <span>{isVerifying ? "Verifying OTP..." : "Verify OTP & Log In"}</span>
              </button>
            </form>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={isResending}
                className="hover:text-white transition-colors flex items-center gap-1 font-medium text-orange-400 disabled:opacity-50"
              >
                <RefreshCw size={13} className={isResending ? "animate-spin" : ""} />
                <span>{isResending ? "Sending..." : "Resend OTP code"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="hover:text-white transition-colors"
              >
                Cancel &amp; return
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

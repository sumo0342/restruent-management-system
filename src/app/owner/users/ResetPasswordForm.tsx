"use client";

import { useState, useRef } from "react";
import { Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { resetPasswordAction } from "@/lib/actions/owner";

interface ResetPasswordFormProps {
  userId: string;
  userName: string;
}

export function ResetPasswordForm({ userId, userName }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (type: "success" | "error" | "info", text: string, durationMs = 4000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFeedback({ type, text });
    timerRef.current = setTimeout(() => {
      setFeedback(null);
    }, durationMs);
  };

  const handleGeneratePassword = () => {
    const prefixes = ["Chef", "Staff", "Team", "Safe", "Fast", "Pass"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const generated = `${prefix}#${randomDigits}`;

    setPassword(generated);
    setShowPassword(true);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(generated).then(
        () => showNotification("info", `Generated "${generated}" (copied to clipboard!)`, 4500),
        () => showNotification("info", `Generated "${generated}"`, 4000)
      );
    } else {
      showNotification("info", `Generated "${generated}"`, 4000);
    }

    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = password.trim();
    if (!trimmed) {
      showNotification("error", "Please enter a new password (min 8 chars) or click ⚡ to auto-generate.");
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length < 8) {
      showNotification("error", "Password must be at least 8 characters.");
      inputRef.current?.focus();
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("newPassword", trimmed);

      const res = await resetPasswordAction(formData);

      if (res && res.error) {
        showNotification("error", res.error);
      } else {
        showNotification("success", `Password reset successfully for ${userName}!`);
        setPassword("");
        setShowPassword(false);
      }
    } catch (err: any) {
      showNotification("error", err?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <form onSubmit={handleSubmit} className="flex items-center gap-1">
        <input type="hidden" name="userId" value={userId} />

        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type={showPassword ? "text" : "password"}
            name="newPassword"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (feedback?.type === "error") setFeedback(null);
            }}
            placeholder="New pass (min 8)"
            disabled={loading}
            className={`input !py-1 !text-xs !pr-14 w-36 transition-all ${
              feedback?.type === "error" ? "!border-rose-500/70 !bg-rose-500/10 focus:!ring-rose-500/40" : ""
            }`}
          />

          <div className="absolute right-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleGeneratePassword}
              title="Auto-generate a strong 8-character password"
              className="p-1 rounded text-smoke hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              <Sparkles size={13} />
            </button>
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              title={showPassword ? "Hide password" : "Show password"}
              className="p-1 rounded text-smoke hover:text-ink hover:bg-white/10 transition-colors"
            >
              {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-secondary !px-2.5 !py-1 text-xs flex items-center gap-1 font-medium transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Reset</span>
          )}
        </button>
      </form>

      {/* Floating feedback notification toast */}
      {feedback && (
        <div
          role="alert"
          className={`absolute left-0 top-full mt-1.5 z-40 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 shadow-2xl backdrop-blur-xl border animate-toast whitespace-nowrap ${
            feedback.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50"
              : feedback.type === "error"
              ? "bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/50"
              : "bg-teal-950/90 text-teal-200 border-teal-500/40 shadow-teal-950/50"
          }`}
        >
          {feedback.type === "success" && <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />}
          {feedback.type === "error" && <AlertCircle size={13} className="shrink-0 text-rose-400" />}
          {feedback.type === "info" && <Sparkles size={13} className="shrink-0 text-teal-400" />}

          <span className="font-medium">{feedback.text}</span>

          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="ml-1 text-white/50 hover:text-white rounded px-1 transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

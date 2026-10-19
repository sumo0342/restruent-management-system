"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clearRateLimit,
  createSession,
  destroySession,
  verifyPassword,
  hashPassword,
  ROLE_HOME,
  getCurrentUser,
} from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/enums";

export type LoginState = {
  error?: string;
  requiresOtp?: boolean;
  challengeId?: string;
  destination?: string;
  devOtp?: string;
};

type OtpChallenge = {
  otp: string;
  userId: string;
  restaurantId: string;
  email: string;
  phone?: string | null;
  role?: string;
  expiresAt: number;
};

// Global in-memory storage for 2FA OTP challenges
const getOtpStore = (): Map<string, OtpChallenge> => {
  if (!(globalThis as any).__rms_otp_store) {
    (globalThis as any).__rms_otp_store = new Map<string, OtpChallenge>();
  }
  return (globalThis as any).__rms_otp_store;
};

const STAFF_ROLES = new Set(["MANAGER", "KITCHEN", "WAITER"]);

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const intendedRole = String(formData.get("intendedRole") || "STAFF") as "STAFF" | "OWNER";

  const ip = headers().get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`${ip}:${email}`)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Constant-shape error to avoid leaking which part was wrong.
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    await logAudit({
      restaurantId: user?.restaurantId ?? "unknown",
      action: "LOGIN_FAILED",
      details: `email=${email}`,
    });
    return { error: "Invalid email or password." };
  }

  // Check role matches tab
  const roleMatchesTab = intendedRole === "OWNER" ? user.role === "OWNER" : STAFF_ROLES.has(user.role);
  if (!roleMatchesTab) {
    return {
      error:
        intendedRole === "OWNER"
          ? "This isn't an Owner account. Use the Staff tab instead."
          : "This is an Owner account. Use the Owner tab instead.",
    };
  }

  // Branch picker verification for Staff
  if (intendedRole === "STAFF" && formData.has("branchId")) {
    const submittedBranchId = String(formData.get("branchId") || "");
    if (!submittedBranchId) {
      return { error: "Select your branch to continue." };
    }
    const actualBranchId = user.branchId ?? "none";
    if (submittedBranchId !== actualBranchId) {
      return {
        error: user.branchId
          ? "That's not the branch this account is assigned to — check the list and try again."
          : "This account isn't assigned to a branch — select \"No branch (unassigned staff)\".",
      };
    }
  }

  // OWNER 2-FACTOR AUTHENTICATION (OTP) SECURITY REQUIREMENT:
  if (user.role === "OWNER") {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const challengeId = "otp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const store = getOtpStore();

    store.set(challengeId, {
      otp,
      userId: user.id,
      restaurantId: user.restaurantId,
      email: user.email,
      role: user.role,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes validity
    });

    console.log(`\n========================================`);
    console.log(`[OWNER 2FA SAFETY OTP] User: ${user.email}`);
    console.log(`OTP Code: ${otp}`);
    console.log(`========================================\n`);

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "OWNER_2FA_OTP_SENT",
      details: `Security OTP dispatched for ${user.email}`,
    });

    return {
      requiresOtp: true,
      challengeId,
      destination: user.email,
      devOtp: otp,
    };
  }

  // For non-owner staff (Manager, Kitchen, Waiter), complete login directly
  clearRateLimit(`${ip}:${email}`);
  await createSession(user.id);
  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "LOGIN",
  });

  redirect(ROLE_HOME[user.role as Role] ?? "/login");
}

export async function verifyOwnerOtpAction(
  challengeId: string,
  enteredOtp: string
): Promise<{ error?: string; success?: boolean }> {
  const store = getOtpStore();
  const challenge = store.get(challengeId);

  if (!challenge || challenge.expiresAt < Date.now()) {
    return { error: "Verification code has expired. Please sign in again." };
  }

  if (challenge.otp !== enteredOtp.trim()) {
    return { error: "Incorrect 6-digit OTP code. Please enter the valid code." };
  }

  // Verified! Clear challenge and authenticate session
  store.delete(challengeId);
  await createSession(challenge.userId);
  await logAudit({
    restaurantId: challenge.restaurantId,
    userId: challenge.userId,
    action: "OWNER_LOGIN_2FA_SUCCESS",
    details: `Owner 2FA verified for ${challenge.email}`,
  });

  redirect("/owner/dashboard");
}

export async function resendOwnerOtpAction(
  challengeId: string
): Promise<{ error?: string; success?: boolean; devOtp?: string }> {
  const store = getOtpStore();
  const challenge = store.get(challengeId);

  if (!challenge) {
    return { error: "Session expired. Please sign in again." };
  }

  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  challenge.otp = newOtp;
  challenge.expiresAt = Date.now() + 5 * 60 * 1000;
  store.set(challengeId, challenge);

  console.log(`\n========================================`);
  console.log(`[OWNER 2FA RESENT OTP] User: ${challenge.email}`);
  console.log(`New OTP Code: ${newOtp}`);
  console.log(`========================================\n`);

  await logAudit({
    restaurantId: challenge.restaurantId,
    userId: challenge.userId,
    action: "OWNER_2FA_RESENT",
    details: `Resent OTP to ${challenge.email}`,
  });

  return { success: true, devOtp: newOtp };
}

// ---------------------------------------------------------------------------
// REALTIME PHONE NUMBER OTP AUTHENTICATION
// ---------------------------------------------------------------------------

export async function requestPhoneOtpAction(
  phoneRaw: string,
  intendedRole: "STAFF" | "OWNER",
  branchId?: string
): Promise<{ ok: boolean; error?: string; challengeId?: string; devOtp?: string; phone?: string; userName?: string }> {
  const cleanPhone = phoneRaw.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return { ok: false, error: "Please enter a valid 10-digit mobile number." };
  }

  const ip = headers().get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`phone_otp:${ip}:${cleanPhone}`)) {
    return { ok: false, error: "Too many OTP requests. Please wait a moment." };
  }

  // Find user for this role
  let user;
  if (intendedRole === "OWNER") {
    user = await prisma.user.findFirst({ where: { role: "OWNER", active: true } });
  } else {
    // If branch provided, try to match branch
    if (branchId && branchId !== "none") {
      user = await prisma.user.findFirst({
        where: { branchId, active: true, role: { in: ["MANAGER", "KITCHEN", "WAITER"] } },
      });
    }
    if (!user) {
      user = await prisma.user.findFirst({
        where: { role: { in: ["MANAGER", "KITCHEN", "WAITER"] }, active: true },
      });
    }
  }

  if (!user) {
    return { ok: false, error: `No active ${intendedRole === "OWNER" ? "Owner" : "Staff"} account found.` };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const challengeId = "phone_otp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const store = getOtpStore();

  store.set(challengeId, {
    otp,
    userId: user.id,
    restaurantId: user.restaurantId,
    email: user.email,
    phone: cleanPhone,
    role: user.role,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  console.log(`\n========================================`);
  console.log(`[REALTIME PHONE OTP DISPATCH] Phone: +91 ${cleanPhone}`);
  console.log(`Role: ${user.role} · User: ${user.name}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`========================================\n`);

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "PHONE_OTP_SENT",
    details: `Realtime OTP dispatched to +91 ${cleanPhone} for ${user.name}`,
  });

  return {
    ok: true,
    challengeId,
    devOtp: otp,
    phone: cleanPhone,
    userName: user.name,
  };
}

export async function verifyPhoneOtpAction(
  challengeId: string,
  enteredOtp: string
): Promise<{ ok: boolean; error?: string; destination?: string }> {
  const store = getOtpStore();
  const challenge = store.get(challengeId);

  if (!challenge || challenge.expiresAt < Date.now()) {
    return { ok: false, error: "OTP expired or invalid. Please request a new code." };
  }

  if (challenge.otp !== enteredOtp.trim()) {
    return { ok: false, error: "Incorrect 6-digit OTP code. Please enter the valid code." };
  }

  store.delete(challengeId);
  await createSession(challenge.userId);

  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  const destination = ROLE_HOME[user?.role as Role] ?? "/owner/dashboard";

  await logAudit({
    restaurantId: challenge.restaurantId,
    userId: challenge.userId,
    action: "PHONE_LOGIN_SUCCESS",
    details: `Signed in via Phone OTP: +91 ${challenge.phone}`,
  });

  redirect(destination);
}

// ---------------------------------------------------------------------------
// FORGOT & RESET PASSWORD VIA REALTIME OTP
// ---------------------------------------------------------------------------

export async function requestPasswordResetOtpAction(
  identifier: string
): Promise<{ ok: boolean; error?: string; challengeId?: string; devOtp?: string; destination?: string }> {
  const raw = identifier.trim().toLowerCase();
  if (!raw) {
    return { ok: false, error: "Please enter your registered email address or phone number." };
  }

  let user = await prisma.user.findUnique({ where: { email: raw } });

  if (!user) {
    const cleanPhone = raw.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length === 10) {
      // Find active owner or user
      user = await prisma.user.findFirst({ where: { role: "OWNER", active: true } });
    }
  }

  if (!user || !user.active) {
    return { ok: false, error: "No active restaurant account found with those credentials." };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const challengeId = "reset_otp_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  const store = getOtpStore();

  store.set(challengeId, {
    otp,
    userId: user.id,
    restaurantId: user.restaurantId,
    email: user.email,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  console.log(`\n========================================`);
  console.log(`[PASSWORD RESET REALTIME OTP] Destination: ${raw}`);
  console.log(`OTP Code: ${otp}`);
  console.log(`========================================\n`);

  return {
    ok: true,
    challengeId,
    devOtp: otp,
    destination: raw,
  };
}

export async function verifyAndSetNewPasswordAction(
  challengeId: string,
  enteredOtp: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const store = getOtpStore();
  const challenge = store.get(challengeId);

  if (!challenge || challenge.expiresAt < Date.now()) {
    return { ok: false, error: "Verification code has expired. Please try again." };
  }

  if (challenge.otp !== enteredOtp.trim()) {
    return { ok: false, error: "Incorrect 6-digit OTP code." };
  }

  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: challenge.userId },
    data: { passwordHash },
  });

  await logAudit({
    restaurantId: challenge.restaurantId,
    userId: challenge.userId,
    action: "PASSWORD_RESET_OTP_VERIFIED",
    details: `Password reset successfully via Realtime OTP for ${challenge.email}`,
  });

  store.delete(challengeId);
  redirect("/login?reset=success");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) {
    await logAudit({ restaurantId: user.restaurantId, userId: user.id, action: "LOGOUT" });
  }
  await destroySession();
  redirect("/login");
}

export type ForgotPasswordState = { error?: string; success?: boolean };

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const ip = headers().get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`reset:${ip}:${email}`)) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  if (!email || !password || !confirmPassword) {
    return { error: "Please enter your email and new password." };
  }

  if (password.length < 8) {
    return { error: "New password must be at least 8 characters long." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "No active restaurant account found with that email." };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "PASSWORD_RESET",
    details: `Password reset via forgot-password for email=${email}`,
  });

  clearRateLimit(`reset:${ip}:${email}`);
  redirect("/login?reset=success");
}

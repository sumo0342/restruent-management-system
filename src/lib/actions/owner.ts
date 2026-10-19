"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/lib/enums";

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------

// Looks up a submitted branchId and makes sure it actually belongs to this
// restaurant before trusting it — returns undefined for "no branch"
// (empty string, or omitted entirely), which keeps the field null.
async function resolveBranchId(restaurantId: string, formData: FormData): Promise<string | undefined> {
  const raw = String(formData.get("branchId") || "").trim();
  if (!raw) return undefined;
  const branch = await prisma.branch.findFirst({ where: { id: raw, restaurantId } });
  if (!branch) throw new Error("That branch doesn't exist.");
  return branch.id;
}

export async function createUserAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "") as Role;
  const branchId = await resolveBranchId(user.restaurantId, formData);

  if (!name || !email || password.length < 8 || !["MANAGER", "KITCHEN", "WAITER", "OWNER"].includes(role)) {
    throw new Error("Fill every field. Password must be at least 8 characters.");
  }

  const created = await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
      restaurantId: user.restaurantId,
      branchId,
    },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: created.id,
    details: `${created.name} (${created.role})`,
  });

  revalidatePath("/owner/users");
}

export async function toggleUserActiveAction(userId: string) {
  const owner = await requireRole("OWNER");
  const target = await prisma.user.findFirst({ where: { id: userId, restaurantId: owner.restaurantId } });
  if (!target) throw new Error("User not found.");
  if (target.id === owner.id) throw new Error("You can't disable your own account.");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { active: !target.active },
  });

  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.id,
    action: updated.active ? "USER_ENABLED" : "USER_DISABLED",
    entityType: "User",
    entityId: userId,
    details: updated.name,
  });

  revalidatePath("/owner/users");
}

export type ResetPasswordResult = {
  error?: string;
  success?: boolean;
};

export async function resetPasswordAction(
  prevStateOrFormData: any,
  formDataOrEmpty?: FormData
): Promise<ResetPasswordResult> {
  const formData =
    formDataOrEmpty instanceof FormData
      ? formDataOrEmpty
      : prevStateOrFormData instanceof FormData
      ? prevStateOrFormData
      : new FormData();

  try {
    const owner = await requireRole("OWNER");
    const userId = String(formData.get("userId") || "").trim();
    const newPassword = String(formData.get("newPassword") || "").trim();

    if (!userId) {
      return { error: "User ID is required." };
    }
    if (!newPassword) {
      return { error: "Please enter a new password (min 8 characters)." };
    }
    if (newPassword.length < 8) {
      return { error: "Password must be at least 8 characters long." };
    }

    const target = await prisma.user.findFirst({ where: { id: userId, restaurantId: owner.restaurantId } });
    if (!target) {
      return { error: "User not found." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    await logAudit({
      restaurantId: owner.restaurantId,
      userId: owner.id,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: userId,
      details: target.name,
    });

    revalidatePath("/owner/users");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to reset password." };
  }
}

// Reassigns an existing staff member to a different branch (or to no
// branch, if branchId is left empty). Owner accounts aren't branch-scoped
// in practice (the OWNER role always sees every branch regardless), but
// they're allowed to carry a branchId too for display purposes.
export async function updateUserBranchAction(formData: FormData) {
  const owner = await requireRole("OWNER");
  const userId = String(formData.get("userId") || "");
  const branchId = await resolveBranchId(owner.restaurantId, formData);

  const target = await prisma.user.findFirst({ where: { id: userId, restaurantId: owner.restaurantId } });
  if (!target) throw new Error("User not found.");

  await prisma.user.update({ where: { id: userId }, data: { branchId: branchId ?? null } });

  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.id,
    action: "USER_BRANCH_CHANGED",
    entityType: "User",
    entityId: userId,
    details: target.name,
  });

  revalidatePath("/owner/users");
}

// ---------------------------------------------------------------------------
// MENU
// ---------------------------------------------------------------------------

export async function createCategoryAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const name = String(formData.get("name") || "").trim();
  const branchId = await resolveBranchId(user.restaurantId, formData);
  if (!name) throw new Error("Category name is required.");

  await prisma.menuCategory.create({ data: { name, restaurantId: user.restaurantId, branchId } });
  await logAudit({ restaurantId: user.restaurantId, userId: user.id, action: "CATEGORY_CREATED", details: name });
  revalidatePath("/owner/menu");
}

export async function createMenuItemAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const name = String(formData.get("name") || "").trim();
  const price = Number(formData.get("price"));
  const categoryId = String(formData.get("categoryId") || "");
  const description = String(formData.get("description") || "").trim() || undefined;
  const isVeg = formData.get("isVeg") === "on";
  const prepTimeMins = Number(formData.get("prepTimeMins") || 10);

  if (!name || !categoryId || !Number.isFinite(price) || price <= 0) {
    throw new Error("Name, category and a positive price are required.");
  }

  // An item lives in exactly one branch scope — whichever its category is
  // in — rather than being set independently, so the two can't drift apart.
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, restaurantId: user.restaurantId },
  });
  if (!category) throw new Error("Category not found.");

  const item = await prisma.menuItem.create({
    data: {
      name,
      price,
      categoryId,
      restaurantId: user.restaurantId,
      branchId: category.branchId,
      description,
      isVeg,
      prepTimeMins,
    },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "MENU_ITEM_CREATED",
    entityType: "MenuItem",
    entityId: item.id,
    details: `${name} — ₹${price}`,
  });

  revalidatePath("/owner/menu");
}

export async function toggleMenuItemAvailabilityAction(itemId: string) {
  const user = await requireRole("OWNER");
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId: user.restaurantId } });
  if (!item) throw new Error("Item not found.");

  const updated = await prisma.menuItem.update({
    where: { id: itemId },
    data: { available: !item.available },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: updated.available ? "MENU_ITEM_ENABLED" : "MENU_ITEM_DISABLED",
    entityType: "MenuItem",
    entityId: itemId,
    details: item.name,
  });

  revalidatePath("/owner/menu");
}

export async function updateMenuItemPriceAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const itemId = String(formData.get("itemId"));
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price <= 0) throw new Error("Enter a valid price.");

  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId: user.restaurantId } });
  if (!item) throw new Error("Item not found.");

  await prisma.menuItem.update({ where: { id: itemId }, data: { price } });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "PRICE_CHANGED",
    entityType: "MenuItem",
    entityId: itemId,
    details: `${item.name}: ₹${item.price} → ₹${price}`,
  });

  revalidatePath("/owner/menu");
}

// Soft-delete: menu items may be referenced by historical order items, so we
// deactivate rather than hard-delete (spec rule #9).
export async function deactivateMenuItemAction(itemId: string) {
  const user = await requireRole("OWNER");
  const item = await prisma.menuItem.findFirst({ where: { id: itemId, restaurantId: user.restaurantId } });
  if (!item) throw new Error("Item not found.");

  await prisma.menuItem.update({ where: { id: itemId }, data: { available: false } });
  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "MENU_ITEM_DEACTIVATED",
    entityType: "MenuItem",
    entityId: itemId,
    details: item.name,
  });
  revalidatePath("/owner/menu");
}

// ---------------------------------------------------------------------------
// TABLES
// ---------------------------------------------------------------------------

export async function createTableAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const number = String(formData.get("number") || "").trim();
  const capacity = Number(formData.get("capacity"));
  const section = String(formData.get("section") || "").trim() || undefined;
  const branchId = await resolveBranchId(user.restaurantId, formData);

  if (!number || !Number.isFinite(capacity) || capacity <= 0) {
    throw new Error("Table number and a positive capacity are required.");
  }

  const existing = await prisma.restaurantTable.findFirst({
    where: { restaurantId: user.restaurantId, branchId: branchId ?? null, number },
  });
  if (existing) throw new Error(`Table ${number} already exists${branchId ? " in this branch" : ""}.`);

  const table = await prisma.restaurantTable.create({
    data: { number, capacity, section, restaurantId: user.restaurantId, branchId },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "TABLE_CREATED",
    entityType: "RestaurantTable",
    entityId: table.id,
    details: `Table ${number} (${capacity} seats)`,
  });

  revalidatePath("/owner/tables");
}

export async function toggleTableActiveAction(tableId: string) {
  const user = await requireRole("OWNER");
  const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId: user.restaurantId } });
  if (!table) throw new Error("Table not found.");

  const updated = await prisma.restaurantTable.update({
    where: { id: tableId },
    data: { active: !table.active },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: updated.active ? "TABLE_ENABLED" : "TABLE_DEACTIVATED",
    entityType: "RestaurantTable",
    entityId: tableId,
    details: `Table ${table.number}`,
  });

  revalidatePath("/owner/tables");
}

// Reassigns an existing table to a different branch (or to no branch).
export async function updateTableBranchAction(formData: FormData) {
  const owner = await requireRole("OWNER");
  const tableId = String(formData.get("tableId") || "");
  const branchId = await resolveBranchId(owner.restaurantId, formData);

  const table = await prisma.restaurantTable.findFirst({ where: { id: tableId, restaurantId: owner.restaurantId } });
  if (!table) throw new Error("Table not found.");

  const clash = await prisma.restaurantTable.findFirst({
    where: { restaurantId: owner.restaurantId, branchId: branchId ?? null, number: table.number, id: { not: tableId } },
  });
  if (clash) throw new Error(`Table ${table.number} already exists${branchId ? " in that branch" : ""}.`);

  await prisma.restaurantTable.update({ where: { id: tableId }, data: { branchId: branchId ?? null } });

  await logAudit({
    restaurantId: owner.restaurantId,
    userId: owner.id,
    action: "TABLE_BRANCH_CHANGED",
    entityType: "RestaurantTable",
    entityId: tableId,
    details: `Table ${table.number}`,
  });

  revalidatePath("/owner/tables");
}

// ---------------------------------------------------------------------------
// BRANCHES
// ---------------------------------------------------------------------------

export async function createBranchAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim() || undefined;
  if (!name) throw new Error("Branch name is required.");

  const existing = await prisma.branch.findFirst({ where: { restaurantId: user.restaurantId, name } });
  if (existing) throw new Error("A branch with that name already exists.");

  const branch = await prisma.branch.create({
    data: { name, address, restaurantId: user.restaurantId },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "BRANCH_CREATED",
    entityType: "Branch",
    entityId: branch.id,
    details: name,
  });

  revalidatePath("/owner/branches");
}

export async function toggleBranchActiveAction(branchId: string) {
  const user = await requireRole("OWNER");
  const branch = await prisma.branch.findFirst({ where: { id: branchId, restaurantId: user.restaurantId } });
  if (!branch) throw new Error("Branch not found.");

  const updated = await prisma.branch.update({ where: { id: branchId }, data: { active: !branch.active } });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: updated.active ? "BRANCH_ENABLED" : "BRANCH_DISABLED",
    entityType: "Branch",
    entityId: branchId,
    details: branch.name,
  });

  revalidatePath("/owner/branches");
}

// ---------------------------------------------------------------------------
// NOTES
// ---------------------------------------------------------------------------

export async function createNoteAction(formData: FormData) {
  const user = await requireRole("OWNER", "MANAGER");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || undefined;
  const priority = String(formData.get("priority") || "MEDIUM") as any;
  if (!title) throw new Error("Title is required.");

  await prisma.note.create({
    data: { title, description, priority, restaurantId: user.restaurantId, createdById: user.id },
  });

  await logAudit({ restaurantId: user.restaurantId, userId: user.id, action: "NOTE_CREATED", details: title });
  revalidatePath("/owner/notes");
}

export async function toggleNoteStatusAction(noteId: string) {
  const user = await requireRole("OWNER", "MANAGER");
  const note = await prisma.note.findFirst({ where: { id: noteId, restaurantId: user.restaurantId } });
  if (!note) throw new Error("Note not found.");

  await prisma.note.update({
    where: { id: noteId },
    data: { status: note.status === "OPEN" ? "DONE" : "OPEN" },
  });
  revalidatePath("/owner/notes");
}

// ---------------------------------------------------------------------------
// MAINTENANCE
// ---------------------------------------------------------------------------

export async function createMaintenanceAction(formData: FormData) {
  const user = await requireRole("OWNER", "MANAGER");
  const equipment = String(formData.get("equipment") || "").trim();
  const problem = String(formData.get("problem") || "").trim();
  const priority = String(formData.get("priority") || "MEDIUM") as any;
  const assignedTo = String(formData.get("assignedTo") || "").trim() || undefined;
  if (!equipment || !problem) throw new Error("Equipment and problem are required.");

  const record = await prisma.maintenanceRecord.create({
    data: { equipment, problem, priority, assignedTo, restaurantId: user.restaurantId, reportedById: user.id },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "MAINTENANCE_REPORTED",
    entityType: "MaintenanceRecord",
    entityId: record.id,
    details: `${equipment}: ${problem}`,
  });
  revalidatePath("/owner/maintenance");
}

export async function updateMaintenanceStatusAction(formData: FormData) {
  const user = await requireRole("OWNER", "MANAGER");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as any;
  const cost = formData.get("cost") ? Number(formData.get("cost")) : undefined;

  await prisma.maintenanceRecord.update({
    where: { id },
    data: { status, cost, completedAt: status === "COMPLETED" ? new Date() : undefined },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "MAINTENANCE_UPDATED",
    entityType: "MaintenanceRecord",
    entityId: id,
    details: `Status → ${status}`,
  });
  revalidatePath("/owner/maintenance");
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

export async function updateSettingsAction(formData: FormData) {
  const user = await requireRole("OWNER");
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim() || undefined;
  const phone = String(formData.get("phone") || "").trim() || undefined;
  const gstin = String(formData.get("gstin") || "").trim() || undefined;
  const taxPercent = Number(formData.get("taxPercent"));
  const serviceChargePercent = Number(formData.get("serviceChargePercent"));
  const invoiceFooter = String(formData.get("invoiceFooter") || "").trim() || undefined;
  const upiId = String(formData.get("upiId") || "").trim() || null;

  await prisma.restaurant.update({
    where: { id: user.restaurantId },
    data: { name, address, phone, gstin, taxPercent, serviceChargePercent, invoiceFooter, upiId },
  });

  await logAudit({ restaurantId: user.restaurantId, userId: user.id, action: "SETTINGS_UPDATED" });
  revalidatePath("/owner/settings");
}

export type PasswordChangeState = { success?: boolean; error?: string };

export async function changeOwnerPasswordAction(
  _prev: PasswordChangeState,
  formData: FormData
): Promise<PasswordChangeState> {
  const user = await requireRole("OWNER");
  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (newPassword.length < 6) {
    return { error: "New password must be at least 6 characters long." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match." };
  }

  const currentUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!currentUser) {
    return { error: "Account not found." };
  }

  const valid = await verifyPassword(currentPassword, currentUser.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await logAudit({
    restaurantId: user.restaurantId,
    userId: user.id,
    action: "PASSWORD_CHANGED",
    entityType: "User",
    entityId: user.id,
    details: "Owner password changed successfully",
  });

  revalidatePath("/owner/settings");
  return { success: true };
}

export async function setOwnerPasswordDirectAction(
  _prev: PasswordChangeState,
  formData: FormData
): Promise<PasswordChangeState> {
  try {
    const user = await requireRole("OWNER");
    const newPassword = String(formData.get("newPassword") || "").trim();
    const confirmPassword = String(formData.get("confirmPassword") || "").trim();

    if (!newPassword || !confirmPassword) {
      return { error: "Please enter and confirm your new password." };
    }

    if (newPassword.length < 8) {
      return { error: "New password must be at least 8 characters long." };
    }

    if (newPassword !== confirmPassword) {
      return { error: "Passwords do not match." };
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    await logAudit({
      restaurantId: user.restaurantId,
      userId: user.id,
      action: "OWNER_PASSWORD_DIRECT_RESET",
      entityType: "User",
      entityId: user.id,
      details: "Owner directly set a new master password",
    });

    revalidatePath("/owner/settings");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to update owner password." };
  }
}



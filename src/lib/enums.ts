// "Enum" fields (role, status, priority, ...) are plain String columns in
// schema.prisma rather than Prisma's native enum type. MongoDB does support
// Prisma enums, but strings were kept for portability across database
// engines — these string-literal union types are the single source of truth
// for allowed values, used everywhere in the app instead of a generated enum.

export const ROLES = ["OWNER", "MANAGER", "KITCHEN", "WAITER"] as const;
export type Role = (typeof ROLES)[number];

export const TABLE_STATUSES = [
  "AVAILABLE",
  "OCCUPIED",
  "ORDER_PENDING",
  "FOOD_READY",
  "WAITING_FOR_BILL",
  "CLEANING",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "BILL_PENDING",
  "BILLED",
  "PAID",
  "CLOSED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "UPI",
  "NET_BANKING",
  "WALLET",
  "GATEWAY",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NOTE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type NotePriority = (typeof NOTE_PRIORITIES)[number];

export const NOTE_STATUSES = ["OPEN", "DONE"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

export const MAINTENANCE_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type MaintenanceStatus = (typeof MAINTENANCE_STATUSES)[number];

export const MAINTENANCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type MaintenancePriority = (typeof MAINTENANCE_PRIORITIES)[number];

export const SHIFT_STATUSES = ["OPEN", "CLOSED"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

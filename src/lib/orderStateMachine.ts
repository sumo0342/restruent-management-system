import type { OrderStatus, Role } from "@/lib/enums";

// Every legal transition, and which roles may perform it.
// OWNER may additionally override any transition (logged as an override).
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, Role[]>>> = {
  PENDING: {
    PREPARING: ["KITCHEN"],
    CANCEL_REQUESTED: ["WAITER"],
    CANCELLED: ["OWNER"],
  },
  PREPARING: {
    READY: ["KITCHEN"],
    CANCEL_REQUESTED: ["WAITER"],
  },
  READY: {
    SERVED: ["WAITER"],
  },
  SERVED: {
    BILL_PENDING: ["WAITER", "MANAGER"],
  },
  BILL_PENDING: {
    BILLED: ["MANAGER"],
  },
  BILLED: {
    PAID: ["MANAGER"],
  },
  PAID: {
    CLOSED: ["MANAGER", "OWNER"],
  },
  CANCEL_REQUESTED: {
    CANCELLED: ["MANAGER", "OWNER"],
  },
  CANCELLED: {},
  CLOSED: {},
};

export function canTransition(
  from: string,
  to: OrderStatus,
  role: Role
): boolean {
  if (role === "OWNER") return true; // owner override, must be logged by caller
  const allowedRoles = TRANSITIONS[from as OrderStatus]?.[to];
  return !!allowedRoles?.includes(role);
}

export function assertTransition(from: string, to: OrderStatus, role: Role) {
  if (!canTransition(from, to, role)) {
    throw new Error(
      `Not allowed: ${role} cannot move an order from ${from} to ${to}`
    );
  }
}

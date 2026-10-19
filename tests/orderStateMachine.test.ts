import { describe, it, expect } from "vitest";
import { canTransition, assertTransition } from "../src/lib/orderStateMachine";

describe("order state machine", () => {
  it("lets kitchen start a pending order", () => {
    expect(canTransition("PENDING", "PREPARING", "KITCHEN")).toBe(true);
  });

  it("does not let a waiter start preparing an order", () => {
    expect(canTransition("PENDING", "PREPARING", "WAITER")).toBe(false);
  });

  it("does not let kitchen touch billing", () => {
    expect(canTransition("SERVED", "BILL_PENDING", "KITCHEN")).toBe(false);
    expect(canTransition("BILLED", "PAID", "KITCHEN")).toBe(false);
  });

  it("lets a waiter serve a ready order but not mark it paid", () => {
    expect(canTransition("READY", "SERVED", "WAITER")).toBe(true);
    expect(canTransition("BILLED", "PAID", "WAITER")).toBe(false);
  });

  it("only manager/owner can move billed -> paid", () => {
    expect(canTransition("BILLED", "PAID", "MANAGER")).toBe(true);
    expect(canTransition("BILLED", "PAID", "OWNER")).toBe(true);
    expect(canTransition("BILLED", "PAID", "WAITER")).toBe(false);
    expect(canTransition("BILLED", "PAID", "KITCHEN")).toBe(false);
  });

  it("waiter can request a cancel, only manager/owner can finalize it", () => {
    expect(canTransition("PENDING", "CANCEL_REQUESTED", "WAITER")).toBe(true);
    expect(canTransition("CANCEL_REQUESTED", "CANCELLED", "WAITER")).toBe(false);
    expect(canTransition("CANCEL_REQUESTED", "CANCELLED", "MANAGER")).toBe(true);
  });

  it("owner can override any transition", () => {
    expect(canTransition("PENDING", "PAID", "OWNER")).toBe(true);
    expect(canTransition("CLOSED", "PENDING", "OWNER")).toBe(true);
  });

  it("assertTransition throws with a clear message on an illegal move", () => {
    expect(() => assertTransition("PENDING", "PAID", "WAITER")).toThrowError(
      /cannot move an order/
    );
  });

  it("terminal states accept no further transitions for non-owners", () => {
    expect(canTransition("CLOSED", "PAID", "MANAGER")).toBe(false);
    expect(canTransition("CANCELLED", "PENDING", "KITCHEN")).toBe(false);
  });
});

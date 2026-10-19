import { describe, it, expect } from "vitest";
import { PAYMENT_METHODS } from "../src/lib/enums";

// Mirrors the calculation in src/app/api/manager/bill/route.ts so the rounding
// rules can be verified without spinning up a database.
function computeBill(subtotal: number, taxPercent: number, servicePercent: number, discount: number) {
  const taxAmount = Math.round(((subtotal * taxPercent) / 100) * 100) / 100;
  const serviceCharge = Math.round(((subtotal * servicePercent) / 100) * 100) / 100;
  const discountAmount = Math.min(discount, subtotal + taxAmount + serviceCharge);
  const total = Math.round((subtotal + taxAmount + serviceCharge - discountAmount) * 100) / 100;
  return { taxAmount, serviceCharge, discountAmount, total };
}

describe("bill calculation", () => {
  it("matches the worked example from the spec (₹850 subtotal, 5% tax, ₹50 discount)", () => {
    const result = computeBill(850, 5, 0, 50);
    expect(result.taxAmount).toBeCloseTo(42.5, 2);
    expect(result.total).toBeCloseTo(842.5, 2);
  });

  it("adds service charge on top of tax", () => {
    const result = computeBill(1000, 5, 10, 0);
    expect(result.taxAmount).toBeCloseTo(50, 2);
    expect(result.serviceCharge).toBeCloseTo(100, 2);
    expect(result.total).toBeCloseTo(1150, 2);
  });

  it("never lets a discount push the total below zero", () => {
    const result = computeBill(100, 5, 0, 999);
    expect(result.discountAmount).toBeCloseTo(105, 2);
    expect(result.total).toBeCloseTo(0, 2);
  });

  it("rounds to 2 decimal places cleanly", () => {
    const result = computeBill(99.99, 5.5, 0, 0);
    expect(Number.isFinite(result.total)).toBe(true);
    expect(result.total.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

describe("split payment validation", () => {
  function paymentsMatchTotal(payments: number[], total: number) {
    const paid = Math.round(payments.reduce((s, p) => s + p, 0) * 100) / 100;
    return Math.abs(paid - total) <= 0.01;
  }

  it("accepts a split that sums exactly to the total (spec example)", () => {
    expect(paymentsMatchTotal([400, 600], 1000)).toBe(true);
  });

  it("rejects a split that under- or over-pays", () => {
    expect(paymentsMatchTotal([400, 500], 1000)).toBe(false);
    expect(paymentsMatchTotal([400, 700], 1000)).toBe(false);
  });

  it("tolerates sub-cent floating point drift", () => {
    expect(paymentsMatchTotal([333.33, 333.33, 333.34], 1000)).toBe(true);
  });

  it("validates all original payment methods (Cash, Card, UPI, Gateway, NetBanking, Wallet)", () => {
    expect(PAYMENT_METHODS).toContain("CASH");
    expect(PAYMENT_METHODS).toContain("CARD");
    expect(PAYMENT_METHODS).toContain("UPI");
    expect(PAYMENT_METHODS).toContain("GATEWAY");
    expect(PAYMENT_METHODS).toContain("NET_BANKING");
    expect(PAYMENT_METHODS).toContain("WALLET");
  });
});

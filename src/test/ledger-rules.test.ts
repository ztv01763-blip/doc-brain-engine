import { describe, expect, it } from "vitest";
import { findDue, normalizePhone, type Customer } from "@/lib/ledger";

const DAY = 86400000;
const now = new Date("2026-10-17T12:00:00Z").getTime();
const c = (over: Partial<Customer>): Customer => ({ id: "x", name: "A", phone: "", entries: [], ...over });

describe("automation rules", () => {
  it("flags balance above minimum with no payment for N days", () => {
    const cust = c({ entries: [{ id: "1", type: "credit", amount: 1000, date: new Date(now - 8 * DAY).toISOString() }] });
    expect(findDue([cust], { overdueDays: 7, minBalance: 500 }, now)).toHaveLength(1);
  });
  it("skips recent or small balances", () => {
    const recent = c({ entries: [{ id: "1", type: "credit", amount: 1000, date: new Date(now - 2 * DAY).toISOString() }] });
    const small = c({ entries: [{ id: "1", type: "credit", amount: 100, date: new Date(now - 30 * DAY).toISOString() }] });
    expect(findDue([recent, small], { overdueDays: 7, minBalance: 500 }, now)).toHaveLength(0);
  });
  it("flags missed promise regardless of days", () => {
    const cust = c({ promiseDate: "2026-10-16", entries: [{ id: "1", type: "credit", amount: 100, date: new Date(now - DAY).toISOString() }] });
    expect(findDue([cust], { overdueDays: 7, minBalance: 500 }, now)[0]!.reason).toContain("promise");
  });
  it("normalizes Pakistani local numbers to +92", () => {
    expect(normalizePhone("0300-1234567")).toBe("+923001234567");
  });
});

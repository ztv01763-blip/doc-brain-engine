import { useCallback, useEffect, useState } from "react";

export type Entry = { id: string; type: "credit" | "payment"; amount: number; date: string; note?: string };
export type Customer = { id: string; name: string; phone: string; entries: Entry[]; promiseDate?: string };
export type Settings = {
  shop: string;
  currency: string;
  language: "English" | "Roman Urdu" | "Urdu";
  tone: "Friendly" | "Professional" | "Firm";
  overdueDays: number;
  minBalance: number;
  autoRun: boolean;
  intervalMin: number;
};
export type QueueItem = { id: string; customerId: string; name: string; phone: string; text: string; reason: string; createdAt: string; status: "pending" | "sent" | "skipped" };
export type RunLog = { at: string; flagged: number; drafted: number; note: string };
export type State = { customers: Customer[]; settings: Settings; queue: QueueItem[]; logs: RunLog[]; lastRun?: string };

const KEY = "credioo-ai-v1";
const DAY = 86400000;
export const uid = () => Math.random().toString(36).slice(2, 10);

const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

export const defaultState = (): State => ({
  settings: { shop: "Meri Dukaan", currency: "Rs.", language: "Roman Urdu", tone: "Friendly", overdueDays: 7, minBalance: 500, autoRun: false, intervalMin: 30 },
  queue: [],
  logs: [],
  customers: [
    { id: uid(), name: "Ahmed Raza", phone: "+923001234567", entries: [{ id: uid(), type: "credit", amount: 4500, date: daysAgo(20) }, { id: uid(), type: "payment", amount: 1000, date: daysAgo(12) }] },
    { id: uid(), name: "Sana Bibi", phone: "+923211112233", entries: [{ id: uid(), type: "credit", amount: 1800, date: daysAgo(3) }], promiseDate: daysAgo(1).slice(0, 10) },
    { id: uid(), name: "Bilal Traders", phone: "+923334445566", entries: [{ id: uid(), type: "credit", amount: 12000, date: daysAgo(35) }] },
    { id: uid(), name: "Usman Ali", phone: "+923451239876", entries: [{ id: uid(), type: "credit", amount: 900, date: daysAgo(4) }, { id: uid(), type: "payment", amount: 900, date: daysAgo(1) }] },
  ],
});

export const balanceOf = (c: Customer) => c.entries.reduce((s, e) => s + (e.type === "credit" ? e.amount : -e.amount), 0);

export const daysSinceLastPayment = (c: Customer, now = Date.now()) => {
  const pays = c.entries.filter((e) => e.type === "payment");
  const ref = pays.length ? pays : c.entries;
  if (!ref.length) return 0;
  const last = Math.max(...ref.map((e) => new Date(e.date).getTime()));
  return Math.floor((now - last) / DAY);
};

/** Automation rule: who needs a reminder right now. */
export function findDue(customers: Customer[], s: Pick<Settings, "overdueDays" | "minBalance">, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  return customers.flatMap((c) => {
    const balance = balanceOf(c);
    if (balance <= 0) return [];
    const days = daysSinceLastPayment(c, now);
    if (c.promiseDate && c.promiseDate < today) return [{ customer: c, balance, days, reason: `Payment promise (${c.promiseDate}) missed` }];
    if (balance >= s.minBalance && days >= s.overdueDays) return [{ customer: c, balance, days, reason: `No payment for ${days} days` }];
    return [];
  });
}

export const normalizePhone = (p: string) => {
  const d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("03")) return "+92" + d.slice(1);
  if (d.startsWith("92")) return "+" + d;
  return d;
};

export function useLedger() {
  const [state, setState] = useState<State>(() => defaultState());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...defaultState(), ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, ready]);
  const update = useCallback((fn: (s: State) => State) => setState(fn), []);
  return { state, update, ready };
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Bell, Bot, Check, LayoutDashboard, MessageCircle, Phone, Plus, Settings2, Users, Workflow, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { askAdvisor, generateReminders } from "@/lib/ai.functions";
import { balanceOf, daysSinceLastPayment, findDue, normalizePhone, uid, useLedger, type Customer, type State } from "@/lib/ledger";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CrediOO AI — Smart Udhaar Khata with Autopilot" },
      { name: "description", content: "Credit ledger for shopkeepers with AI reminder automation and a business advisor." },
      { property: "og:title", content: "CrediOO AI — Smart Udhaar Khata" },
      { property: "og:description", content: "Track customer credit, auto-detect overdue dues, and let AI draft WhatsApp reminders." },
    ],
  }),
  component: App,
});

type Tab = "home" | "customers" | "autopilot" | "advisor" | "settings";
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: "home", label: "Home", icon: LayoutDashboard },
  { id: "customers", label: "Customers", icon: Users },
  { id: "autopilot", label: "Autopilot", icon: Workflow },
  { id: "advisor", label: "AI Advisor", icon: Bot },
  { id: "settings", label: "Settings", icon: Settings2 },
];

function App() {
  const { state, update } = useLedger();
  const [tab, setTab] = useState<Tab>("home");
  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const money = (n: number) => `${state.settings.currency} ${Math.round(n).toLocaleString()}`;

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <Toaster />
      <header className="bg-hero border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow font-display text-lg font-bold">C</div>
            <div>
              <h1 className="text-xl font-bold">CrediOO <span className="text-primary">AI</span></h1>
              <p className="text-xs text-muted-foreground">{state.settings.shop}</p>
            </div>
          </div>
          <nav className="hidden gap-1 md:flex">
            {TABS.map((t) => (
              <Button key={t.id} variant={tab === t.id ? "default" : "ghost"} size="sm" onClick={() => go(t.id)}>
                <t.icon /> {t.label}
              </Button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Autopilot state={state} update={update} visible={tab === "autopilot"} money={money} />
        {tab === "home" && <Home state={state} money={money} go={go} />}
        {tab === "customers" && <Customers state={state} update={update} money={money} />}
        {tab === "advisor" && <Advisor state={state} money={money} />}
        {tab === "settings" && <SettingsView state={state} update={update} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card md:hidden">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${tab === t.id ? "text-primary" : "text-muted-foreground"}`}>
            <t.icon className="h-5 w-5" /> {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

type Upd = (fn: (s: State) => State) => void;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "primary" | "accent" | "destructive" }) {
  const c = tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${c}`}>{value}</p>
    </div>
  );
}

function Home({ state, money, go }: { state: State; money: (n: number) => string; go: (t: Tab) => void }) {
  const total = state.customers.reduce((s, c) => s + Math.max(0, balanceOf(c)), 0);
  const due = findDue(state.customers, state.settings);

  const today = new Date().toDateString();
  const isToday = (d: string) => new Date(d).toDateString() === today;
  const todayStr = new Date().toISOString().slice(0, 10);
  const owing = state.customers.filter((c) => balanceOf(c) > 0);
  const receivedToday = state.customers.flatMap((c) => c.entries).filter((e) => e.type === "payment" && isToday(e.date)).reduce((s, e) => s + e.amount, 0);
  const paidTodayCount = state.customers.filter((c) => c.entries.some((e) => e.type === "payment" && isToday(e.date))).length;
  const dueToday = owing.filter((c) => c.promiseDate === todayStr);
  const promised = owing.filter((c) => c.promiseDate && c.promiseDate > todayStr);
  const followUps = [...due.map((d) => d.customer)].sort((a, b) => balanceOf(b) - balanceOf(a)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total receivable" value={money(total)} tone="primary" />
        <Stat label="Received today" value={money(receivedToday)} tone="accent" />
        <Stat label="Overdue customers" value={String(due.length)} tone="destructive" />
        <Stat label="Due today" value={money(dueToday.reduce((s, c) => s + balanceOf(c), 0))} />
      </div>

      <div className="rounded-2xl border bg-hero p-6">
        <div className="flex items-center gap-2 text-primary"><Zap className="h-5 w-5" /><span className="text-sm font-semibold">Autopilot</span></div>
        <h2 className="mt-2 text-2xl font-bold">{due.length ? `${due.length} customers need a reminder` : "Sab clear hai — koi overdue nahi"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.settings.autoRun ? `Auto-run on — har ${state.settings.intervalMin} min check hota hai.` : "Auto-run off hai. Settings se on karein ya abhi chalayein."}
          {state.lastRun && ` Last run: ${new Date(state.lastRun).toLocaleString()}`}
        </p>
        <Button className="mt-4 shadow-glow" onClick={() => go("autopilot")}><Workflow /> Open Autopilot</Button>
      </div>

      <section className="rounded-2xl border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection pulse</p>
        <h3 className="mb-3 mt-1 font-semibold">Today's collection</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Overdue" value={money(due.reduce((s, d) => s + d.balance, 0))} tone="destructive" />
          <Stat label="Due today" value={money(dueToday.reduce((s, c) => s + balanceOf(c), 0))} />
          <Stat label="Promised" value={money(promised.reduce((s, c) => s + balanceOf(c), 0))} tone="primary" />
          <Stat label="Paid today" value={money(receivedToday)} tone="accent" />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl border bg-secondary/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follow-ups today</p>
              <p className="text-sm">{due.length + dueToday.length ? `${due.length + dueToday.length} customers ko yaad dehani hai` : "You're all caught up for now"}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => go("autopilot")} aria-label="View follow-ups"><ArrowUpRight /></Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keep an eye on</p>
            <h3 className="mt-1 font-semibold">Customers to follow up</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => go("customers")}>All customers <ArrowUpRight /></Button>
        </div>
        {followUps.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-success"><Check className="h-6 w-6" /></div>
            <p className="mt-3 font-semibold">Aaj koi pending payment nahi!</p>
            <p className="text-sm text-muted-foreground">Shabash — filhaal sab customers up to date hain.</p>
          </div>
        ) : (
          followUps.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-t py-3 text-sm first:border-t-0">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{daysSinceLastPayment(c)}d since payment{c.promiseDate ? ` · Promise ${c.promiseDate}` : ""}</p>
              </div>
              <span className="font-display font-bold text-primary">{money(balanceOf(c))}</span>
            </div>
          ))
        )}
      </section>

      <div className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 font-semibold">Top balances</h3>
        {[...state.customers].sort((a, b) => balanceOf(b) - balanceOf(a)).slice(0, 5).map((c) => (
          <div key={c.id} className="flex justify-between border-t py-3 text-sm first:border-t-0">
            <span>{c.name}</span><span className="font-semibold">{money(balanceOf(c))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Customers({ state, update, money }: { state: State; update: Upd; money: (n: number) => string }) {
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = state.customers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  const add = () => {
    if (!name.trim()) { toast.error("Naam likhein"); return; }
    update((s) => ({ ...s, customers: [{ id: uid(), name: name.trim(), phone: normalizePhone(phone), entries: [] }, ...s.customers] }));
    setName(""); setPhone(""); toast.success("Customer added");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-2xl border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
        <Input placeholder="Customer name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Phone (03xx...)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button onClick={add}><Plus /> Add customer</Button>
      </div>
      <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
      {list.map((c) => (
        <CustomerRow key={c.id} c={c} money={money} open={open === c.id} toggle={() => setOpen(open === c.id ? null : c.id)} update={update} />
      ))}
    </div>
  );
}

function CustomerRow({ c, money, open, toggle, update }: { c: Customer; money: (n: number) => string; open: boolean; toggle: () => void; update: Upd }) {
  const [amt, setAmt] = useState("");
  const [promise, setPromise] = useState(c.promiseDate ?? "");
  const bal = balanceOf(c);
  const patch = (fn: (c: Customer) => Customer) => update((s) => ({ ...s, customers: s.customers.map((x) => (x.id === c.id ? fn(x) : x)) }));
  const addEntry = (type: "credit" | "payment") => {
    const n = Number(amt);
    if (!(n > 0)) { toast.error("Sahi amount likhein"); return; }
    if (type === "payment" && n > bal) { toast.error("Payment balance se zyada hai"); return; }
    patch((x) => {
      const next: Customer = { ...x, entries: [...x.entries, { id: uid(), type, amount: n, date: new Date().toISOString() }] };
      if (type === "payment" && n === bal) delete next.promiseDate;
      return next;
    });
    setAmt(""); toast.success(type === "credit" ? "Udhaar recorded" : "Payment recorded");
  };
  return (
    <div className="rounded-2xl border bg-card">
      <button onClick={toggle} className="flex w-full items-center justify-between p-4 text-left">
        <div>
          <p className="font-semibold">{c.name}</p>
          <p className="text-xs text-muted-foreground">{c.phone || "No phone"} · {daysSinceLastPayment(c)}d since payment{c.promiseDate ? ` · Promise ${c.promiseDate}` : ""}</p>
        </div>
        <span className={`font-display font-bold ${bal > 0 ? "text-primary" : "text-success"}`}>{money(bal)}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t p-4">
          <div className="flex flex-wrap gap-2">
            <Input className="w-36" type="number" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
            <Button variant="secondary" onClick={() => addEntry("credit")}>+ Udhaar</Button>
            <Button onClick={() => addEntry("payment")}>Payment</Button>
            {c.phone && <Button variant="outline" size="icon" className="h-11 w-11" asChild><a href={`tel:${c.phone}`} aria-label="Call"><Phone /></a></Button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Promise date</span>
            <Input className="w-44" type="date" value={promise} onChange={(e) => setPromise(e.target.value)} />
            <Button variant="outline" onClick={() => { patch((x) => { const { promiseDate: _p, ...rest } = x; return promise ? { ...rest, promiseDate: promise } : rest; }); toast.success("Promise saved"); }}>Save</Button>
            <Button variant="ghost" className="text-destructive" onClick={() => update((s) => ({ ...s, customers: s.customers.filter((x) => x.id !== c.id) }))}>Delete</Button>
          </div>
          <div className="max-h-48 overflow-auto text-sm">
            {[...c.entries].reverse().map((e) => (
              <div key={e.id} className="flex justify-between border-t py-2 first:border-t-0">
                <span className="text-muted-foreground">{new Date(e.date).toLocaleDateString()} · {e.type === "credit" ? "Udhaar" : "Payment"}</span>
                <span className={e.type === "credit" ? "text-primary" : "text-success"}>{e.type === "credit" ? "+" : "−"}{money(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Always mounted so the auto-run timer keeps working on every tab. */
function Autopilot({ state, update, visible, money }: { state: State; update: Upd; visible: boolean; money: (n: number) => string }) {
  const gen = useServerFn(generateReminders);
  const [running, setRunning] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const due = useMemo(() => findDue(state.customers, state.settings), [state.customers, state.settings]);

  const run = async (auto = false) => {
    const s = stateRef.current;
    const queuedIds = new Set(s.queue.filter((q) => q.status === "pending").map((q) => q.customerId));
    const targets = findDue(s.customers, s.settings).filter((d) => !queuedIds.has(d.customer.id));
    if (!targets.length) {
      update((x) => ({ ...x, lastRun: new Date().toISOString(), logs: [{ at: new Date().toISOString(), flagged: 0, drafted: 0, note: auto ? "Auto run — nothing new" : "Nothing new" }, ...x.logs].slice(0, 30) }));
      if (!auto) toast("Koi naya overdue customer nahi");
      return;
    }
    setRunning(true);
    try {
      const { messages } = await gen({
        data: {
          shop: s.settings.shop, language: s.settings.language, tone: s.settings.tone, currency: s.settings.currency,
          items: targets.slice(0, 40).map((t) => ({ id: t.customer.id, name: t.customer.name, balance: t.balance, daysSincePayment: t.days, reason: t.reason })),
        },
      });
      const now = new Date().toISOString();
      const items = targets.flatMap((t) => {
        const m = messages.find((x) => x.id === t.customer.id);
        return m ? [{ id: uid(), customerId: t.customer.id, name: t.customer.name, phone: t.customer.phone, text: m.text, reason: t.reason, createdAt: now, status: "pending" as const }] : [];
      });
      update((x) => ({ ...x, lastRun: now, queue: [...items, ...x.queue].slice(0, 200), logs: [{ at: now, flagged: targets.length, drafted: items.length, note: auto ? "Auto run" : "Manual run" }, ...x.logs].slice(0, 30) }));
      toast.success(`${items.length} AI reminders ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Autopilot failed");
      update((x) => ({ ...x, logs: [{ at: new Date().toISOString(), flagged: targets.length, drafted: 0, note: "Failed" }, ...x.logs].slice(0, 30) }));
    } finally {
      setRunning(false);
    }
  };

  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    if (!state.settings.autoRun) return;
    const ms = Math.max(1, state.settings.intervalMin) * 60000;
    const last = state.lastRun ? new Date(state.lastRun).getTime() : 0;
    const first = setTimeout(() => runRef.current(true), Math.max(2000, last + ms - Date.now()));
    const iv = setInterval(() => runRef.current(true), ms);
    return () => { clearTimeout(first); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.autoRun, state.settings.intervalMin]);

  const setStatus = (id: string, status: "sent" | "skipped") => update((s) => ({ ...s, queue: s.queue.map((q) => (q.id === id ? { ...q, status } : q)) }));
  const pending = state.queue.filter((q) => q.status === "pending");
  if (!visible) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-hero p-5">
        <h2 className="text-2xl font-bold">Reminder Autopilot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rule: balance ≥ {money(state.settings.minBalance)} aur {state.settings.overdueDays}+ din se payment nahi, ya promise date guzar gayi. AI har customer ke liye {state.settings.language} mein message likhta hai.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button className="shadow-glow" disabled={running} onClick={() => run(false)}><Zap /> {running ? "AI likh raha hai..." : `Run now (${due.length} due)`}</Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={state.settings.autoRun} onCheckedChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, autoRun: v } }))} />
            Auto-run every {state.settings.intervalMin} min
          </label>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold">Ready to send ({pending.length})</h3>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Queue khali hai. "Run now" dabayein.</p>}
        {pending.map((q) => (
          <div key={q.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{q.name}</span>
              <span className="text-xs text-destructive">{q.reason}</span>
            </div>
            <Textarea dir={state.settings.language === "Urdu" ? "rtl" : "ltr"} className="mt-2" rows={4} value={q.text}
              onChange={(e) => update((s) => ({ ...s, queue: s.queue.map((x) => (x.id === q.id ? { ...x, text: e.target.value } : x)) }))} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild disabled={!q.phone} onClick={() => setStatus(q.id, "sent")}>
                <a href={`https://wa.me/${q.phone.replace(/\D/g, "")}?text=${encodeURIComponent(q.text)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
              </Button>
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(q.text); toast.success("Copied"); }}>Copy</Button>
              <Button variant="outline" onClick={() => setStatus(q.id, "sent")}><Check /> Mark sent</Button>
              <Button variant="ghost" onClick={() => setStatus(q.id, "skipped")}><X /> Skip</Button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 font-semibold">Run history</h3>
        {state.logs.length === 0 && <p className="text-sm text-muted-foreground">Abhi tak koi run nahi.</p>}
        {state.logs.slice(0, 10).map((l, i) => (
          <div key={i} className="flex justify-between border-t py-2 text-sm first:border-t-0">
            <span className="text-muted-foreground">{new Date(l.at).toLocaleString()} · {l.note}</span>
            <span>{l.flagged} flagged / {l.drafted} drafted</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Advisor({ state, money }: { state: State; money: (n: number) => string }) {
  const ask = useServerFn(askAdvisor);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const summary = state.customers.map((c) => `${c.name}: balance ${money(balanceOf(c))}, ${daysSinceLastPayment(c)} days since payment${c.promiseDate ? `, promise ${c.promiseDate}` : ""}`).join("\n");
  const submit = async (question: string) => {
    if (!question.trim()) return;
    setBusy(true); setAnswer("");
    try {
      const r = await ask({ data: { shop: state.settings.shop, language: state.settings.language, question, summary } });
      setAnswer(r.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setBusy(false); }
  };
  const ideas = ["Sab se risky customer kaun hai?", "Is hafte kitna collect ho sakta hai?", "Udhaar kam karne ki strategy batao"];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-hero p-5">
        <h2 className="flex items-center gap-2 text-2xl font-bold"><Bot className="text-primary" /> AI Business Advisor</h2>
        <p className="mt-1 text-sm text-muted-foreground">Aap ke khate ke data par sawal poochein.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ideas.map((i) => <Button key={i} variant="secondary" size="sm" onClick={() => { setQ(i); submit(i); }}>{i}</Button>)}
      </div>
      <Textarea rows={3} placeholder="Apna sawal likhein..." value={q} onChange={(e) => setQ(e.target.value)} />
      <Button disabled={busy} onClick={() => submit(q)}>{busy ? "Soch raha hai..." : "Ask CrediOO AI"}</Button>
      {answer && <div dir={state.settings.language === "Urdu" ? "rtl" : "ltr"} className="whitespace-pre-wrap rounded-2xl border bg-card p-4 text-sm leading-relaxed">{answer}</div>}
    </div>
  );
}

function SettingsView({ state, update }: { state: State; update: Upd }) {
  const s = state.settings;
  const set = <K extends keyof State["settings"]>(k: K, v: State["settings"][K]) => update((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  const backup = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `credioo-ai-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const restore = (f: File) => f.text().then((t) => {
    try {
      const d = JSON.parse(t);
      if (!Array.isArray(d.customers) || !d.settings) throw new Error();
      update(() => d); toast.success("Backup restored");
    } catch { toast.error("Backup rejected: invalid file"); }
  });
  const Sel = ({ k, opts }: { k: "language" | "tone"; opts: string[] }) => (
    <select className="h-11 w-full rounded-md border bg-input/30 px-3" value={s[k]} onChange={(e) => set(k, e.target.value as never)}>
      {opts.map((o) => <option key={o} value={o} className="bg-card">{o}</option>)}
    </select>
  );
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-5 md:grid-cols-2">
      <label className="space-y-1 text-sm">Shop name<Input value={s.shop} onChange={(e) => set("shop", e.target.value)} /></label>
      <label className="space-y-1 text-sm">Currency<Input value={s.currency} onChange={(e) => set("currency", e.target.value)} /></label>
      <label className="space-y-1 text-sm">Message language<Sel k="language" opts={["English", "Roman Urdu", "Urdu"]} /></label>
      <label className="space-y-1 text-sm">Tone<Sel k="tone" opts={["Friendly", "Professional", "Firm"]} /></label>
      <label className="space-y-1 text-sm">Overdue after (days)<Input type="number" value={s.overdueDays} onChange={(e) => set("overdueDays", Number(e.target.value) || 1)} /></label>
      <label className="space-y-1 text-sm">Minimum balance<Input type="number" value={s.minBalance} onChange={(e) => set("minBalance", Number(e.target.value) || 0)} /></label>
      <label className="space-y-1 text-sm">Auto-run interval (minutes)<Input type="number" value={s.intervalMin} onChange={(e) => set("intervalMin", Number(e.target.value) || 30)} /></label>
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="secondary" onClick={backup}>Download backup</Button>
        <Button variant="outline" asChild><label className="cursor-pointer">Restore<input hidden type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} /></label></Button>
      </div>
    </div>
  );
}

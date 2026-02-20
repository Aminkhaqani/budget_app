import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { shortJalali } from "../lib/date";

type TxType = "income" | "expense" | "transfer";

export type Tx = {
  id: string;
  type: TxType;

  amountToman: number;
  date: string; // YYYY-MM-DD

  categoryId?: string;

  fromAccountId?: string;
  toAccountId?: string;

  note?: string;
};

export type Category = {
  id: string;
  type: "income" | "expense";
  title: string;
  icon?: string;
  popular?: boolean;
};

export type Account = {
  id: string;
  title: string;
  openingBalanceToman?: number;
};

function NavIcon({ name, active }: { name: "home" | "tx" | "reports" | "settings"; active?: boolean }) {
  const common = `w-5 h-5 ${active ? "text-white" : "text-white/70"}`;
  if (name === "home")
    return (
      <svg viewBox="0 0 24 24" className={common}>
        <path fill="currentColor" d="M12 3 3 10v11h7v-7h4v7h7V10l-9-7Z" />
      </svg>
    );
  if (name === "tx")
    return (
      <svg viewBox="0 0 24 24" className={common}>
        <path fill="currentColor" d="M7 6h14v2H7V6ZM7 11h14v2H7v-2ZM7 16h14v2H7v-2ZM3 6h2v2H3V6Zm0 5h2v2H3v-2Zm0 5h2v2H3v-2Z" />
      </svg>
    );
  if (name === "reports")
    return (
      <svg viewBox="0 0 24 24" className={common}>
        <path fill="currentColor" d="M11 2v20H9V2h2Zm4 8v12h-2V10h2Zm4 5v7h-2v-7h2ZM7 13v9H5v-9h2Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={common}>
      <path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.53 1.63-.94l2.39.96c.24.1.51.01.64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    </svg>
  );
}

function NavItem({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: "home" | "tx" | "reports" | "settings";
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
  `flex flex-col items-center gap-1 text-[11px] ${isActive ? "text-orange" : "text-white/70"}`
}
    >
      {({ isActive }) => (
        <>
                <span className={`px-2.5 py-1.5 rounded-2xl ${isActive ? "bg-orange-soft" : ""}`}>
            <NavIcon name={icon} active={isActive} />
          </span>
          <span className={`${isActive ? "font-extrabold" : "font-semibold"}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDayLabel(iso: string) {
  const t = todayISO();
  if (iso === t) return "امروز";
  return shortJalali(iso);
}

/** "1234567" -> "1,234,567" */
function formatDigitsWithSep(raw: string) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const normalized = String(Number(digits));
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseSepNumber(s: string) {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** mini number-to-words (تومان) for MVP */
function toPersianWordsToman(toman: number) {
  const n = Math.floor(Math.abs(toman));
  if (!n) return "صفر تومان";

  const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const tens = ["", "ده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
  const hundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

  const chunkToWords = (x: number) => {
    const out: string[] = [];
    const h = Math.floor(x / 100);
    const r = x % 100;

    if (h) out.push(hundreds[h]);
    if (r >= 10 && r < 20) out.push(teens[r - 10]);
    else {
      const t = Math.floor(r / 10);
      const o = r % 10;
      if (t) out.push(tens[t]);
      if (o) out.push(ones[o]);
    }
    return out.filter(Boolean).join(" و ");
  };

  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const rest = n % 1_000;

  if (billions) parts.push(`${chunkToWords(billions)} میلیارد`);
  if (millions) parts.push(`${chunkToWords(millions)} میلیون`);
  if (thousands) parts.push(`${chunkToWords(thousands)} هزار`);
  if (rest) parts.push(chunkToWords(rest));

  return `${parts.join(" و ")} تومان`;
}

export default function Appshell() {
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [txs, setTxs] = useState<Tx[]>([
    { id: "t1", type: "expense", amountToman: 45000, date: "2026-02-19", categoryId: "c_exp_food" },
    { id: "t2", type: "expense", amountToman: 120000, date: "2026-02-18", categoryId: "c_exp_shop" },
    { id: "t3", type: "income", amountToman: 1890000, date: "2026-02-17", categoryId: "c_inc_salary" },
    { id: "t4", type: "transfer", amountToman: 250000, date: "2026-02-16", fromAccountId: "a_cash", toAccountId: "a_iman" },
  ]);

  const categories: Category[] = useMemo(
    () => [
      { id: "c_exp_food", type: "expense", title: "خوراک", icon: "🍴", popular: true },
      { id: "c_exp_transport", type: "expense", title: "حمل‌ونقل", icon: "🚗", popular: true },
      { id: "c_exp_bills", type: "expense", title: "قبوض", icon: "🧾", popular: true },
      { id: "c_exp_shop", type: "expense", title: "خرید", icon: "🛍️" },
      { id: "c_exp_debt", type: "expense", title: "قرض", icon: "📄" },

      { id: "c_inc_salary", type: "income", title: "حقوق", icon: "🎁", popular: true },
      { id: "c_inc_freelance", type: "income", title: "فریلنس", icon: "💻", popular: true },
      { id: "c_inc_sale", type: "income", title: "فروش", icon: "🏷️", popular: true },
    ],
    []
  );

  const accounts: Account[] = useMemo(
    () => [
      { id: "a_cash", title: "موجودی نقدی" },
      { id: "a_gold", title: "صندوق طلا" },
      { id: "a_iman", title: "حساب ایمان" },
      { id: "a_saving", title: "پس‌انداز" },
    ],
    []
  );

  const openAdd = () => {
    setEditingId(null);
    setAddOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setAddOpen(true);
  };

  const deleteTx = (id: string) => {
    setTxs((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) {
      setAddOpen(false);
      setEditingId(null);
    }
  };

  const editingTx = editingId ? txs.find((t) => t.id === editingId) ?? null : null;

  const upsertTx = (payload: Omit<Tx, "id">) => {
    if (editingId) {
      setTxs((prev) => prev.map((t) => (t.id === editingId ? { ...payload, id: editingId } : t)));
      return;
    }
    setTxs((prev) => [{ ...payload, id: crypto.randomUUID() }, ...prev]);
  };

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="p-3">
</div>
      <div className="mx-auto min-h-screen max-w-[420px] px-3 sm:px-4 pb-28">
        <Outlet context={{ txs, categories, accounts, openAdd, openEdit, deleteTx }} />
      </div>

      {/* Bottom bar + center FAB */}
      <div className="fixed bottom-0 left-0 right-0">
        <div className="mx-auto max-w-[420px] px-3 sm:px-4">
          <div className="relative mb-4">
            <div className="rounded-3xl bg-navy-900 shadow-lg ring-1 ring-black/10 px-4 py-3">
              <div className="grid grid-cols-5 items-center text-xs">
                <NavItem to="/" label="خانه" icon="home" />
                <NavItem to="/transactions" label="تراکنش‌ها" icon="tx" />
                <div />
                <NavItem to="/reports" label="گزارش" icon="reports" />
                <NavItem to="/settings" label="تنظیمات" icon="settings" />
              </div>
            </div>

            <button
              onClick={openAdd}
              className="absolute left-1/2 -top-6 -translate-x-1/2 h-14 w-14 rounded-2xl bg-orange text-white shadow-2xl ring-1 ring-black/10 active:scale-95 grid place-items-center"              aria-label="افزودن تراکنش"
              title="افزودن تراکنش"
            >
              <span className="text-3xl leading-none">+</span>
            </button>
          </div>
        </div>
      </div>

      {addOpen && (
        <AddTransactionModal
          categories={categories}
          accounts={accounts}
          initialTx={editingTx}
          onClose={() => {
            setAddOpen(false);
            setEditingId(null);
          }}
          onDelete={() => {
            if (editingId) deleteTx(editingId);
          }}
          onEditItem={(kind, id) => alert(`بعداً: ویرایش ${kind} (${id})`)}
          onAddItem={(kind) => alert(`بعداً: افزودن ${kind}`)}
          onSubmit={(tx) => {
            upsertTx(tx);
            setAddOpen(false);
            setEditingId(null);
          }}
        />
      )}
    </div>
  );
}

function AddTransactionModal({
  categories,
  accounts,
  initialTx,
  onClose,
  onSubmit,
  onDelete,
  onEditItem,
  onAddItem,
}: {
  categories: Category[];
  accounts: Account[];
  initialTx: Tx | null;
  onClose: () => void;
  onSubmit: (tx: Omit<Tx, "id">) => void;
  onDelete: () => void;
  onEditItem: (kind: "category" | "account", id: string) => void;
  onAddItem: (kind: "category" | "account") => void;
}) {
  const [type, setType] = useState<TxType>(initialTx?.type ?? "expense");
  const [amountRaw, setAmountRaw] = useState<string>(initialTx ? String(initialTx.amountToman) : "");
  const [date, setDate] = useState<string>(initialTx?.date ?? todayISO());
  const [note, setNote] = useState<string>(initialTx?.note ?? "");

  const [categoryId, setCategoryId] = useState<string>(initialTx?.categoryId ?? "");
  const [fromAccountId, setFromAccountId] = useState<string>(initialTx?.fromAccountId ?? "");
  const [toAccountId, setToAccountId] = useState<string>(initialTx?.toAccountId ?? "");

  // normalize amount on first render (with commas)
  useEffect(() => {
    if (!amountRaw) return;
    setAmountRaw(formatDigitsWithSep(amountRaw));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const amountToman = parseSepNumber(amountRaw);
  const validAmount = Number.isFinite(amountToman) && amountToman > 0;

  const catsOfType = categories.filter((c) => c.type === (type === "income" ? "income" : "expense"));
  const popular3 = catsOfType.filter((c) => c.popular).slice(0, 3);

  const canSubmit =
    validAmount &&
    (type === "transfer"
      ? fromAccountId && toAccountId && fromAccountId !== toAccountId
      : !!categoryId);

  const amountWords = validAmount ? toPersianWordsToman(amountToman) : "";

  const submit = () => {
    if (!canSubmit) return;

    if (type === "transfer") {
      onSubmit({
        type,
        amountToman,
        date,
        fromAccountId,
        toAccountId,
        note: note.trim() || undefined,
      });
      return;
    }

    onSubmit({
      type,
      amountToman,
      date,
      categoryId,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-auto max-w-[420px] px-3 sm:px-4 pb-6">
          <div className="rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-extrabold text-ink">
                {initialTx ? "ویرایش تراکنش" : "ثبت تراکنش جدید"}
              </div>

              <div className="flex items-center gap-2">
                {initialTx && (
                  <button
                    onClick={onDelete}
                    className="h-9 w-9 grid place-items-center rounded-xl bg-orange-50 text-orangeExpense hover:bg-orange-100"
                    title="حذف"
                    aria-label="حذف"
                  >
                    🗑️
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="h-9 w-9 grid place-items-center rounded-xl bg-bg text-muted hover:bg-slate-200"
                  aria-label="بستن"
                  title="بستن"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="rounded-2xl bg-bg ring-1 ring-black/5 p-1 grid grid-cols-3 gap-1 text-xs">
                <SegBtn active={type === "income"} onClick={() => setType("income")}>
                  درآمد
                </SegBtn>
                <SegBtn active={type === "expense"} onClick={() => setType("expense")}>
                  هزینه
                </SegBtn>
                <SegBtn active={type === "transfer"} onClick={() => setType("transfer")}>
                  جابجایی
                </SegBtn>
              </div>

              <div className="space-y-2">
                <input
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(formatDigitsWithSep(e.target.value))}
                  inputMode="numeric"
                  placeholder="مبلغ (تومان)"
                  className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
                {validAmount && <div className="text-[11px] text-muted">{amountWords}</div>}
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10">
                <button
                  onClick={() => setDate((d) => addDays(d, -1))}
                  className="h-9 w-9 rounded-xl bg-bg hover:bg-slate-200 text-navy-900"
                  aria-label="روز قبل"
                  title="روز قبل"
                >
                  ‹
                </button>

                <div className="text-sm font-extrabold text-ink">{formatDayLabel(date)}</div>

                <button
                  onClick={() => setDate((d) => addDays(d, +1))}
                  className="h-9 w-9 rounded-xl bg-bg hover:bg-slate-200 text-navy-900"
                  aria-label="روز بعد"
                  title="روز بعد"
                >
                  ›
                </button>

                <button
                  onClick={() => alert("بعداً: تقویم")}
                  className="mr-2 h-9 w-9 rounded-xl bg-bg hover:bg-slate-200"
                  aria-label="تقویم"
                  title="تقویم"
                >
                  📅
                </button>
              </div>

              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                type="text"
                inputMode="text"
                placeholder="شرح (اختیاری)"
                className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
              />

              {type !== "transfer" ? (
                <div className="space-y-2">
                  <Dropdown
                    placeholder="دسته‌بندی"
                    valueId={categoryId}
                    valueLabel={catsOfType.find((c) => c.id === categoryId)?.title || ""}
                    items={catsOfType.map((c) => ({ id: c.id, label: `${c.icon ?? ""} ${c.title}`.trim() }))}
                    onChange={(id) => setCategoryId(id)}
                    onEdit={(id) => onEditItem("category", id)}
                    onAdd={() => onAddItem("category")}
                    addLabel="افزودن دسته‌بندی"
                  />

                  <div className="flex flex-wrap gap-2 pt-1">
                    {popular3.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategoryId(c.id)}
                        className="rounded-full bg-bg px-3 py-1 text-xs text-ink hover:bg-slate-200"
                        title={c.title}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Dropdown
                    placeholder="پرداخت از"
                    valueId={fromAccountId}
                    valueLabel={accounts.find((a) => a.id === fromAccountId)?.title || ""}
                    items={accounts.map((a) => ({ id: a.id, label: a.title }))}
                    onChange={(id) => setFromAccountId(id)}
                    onEdit={(id) => onEditItem("account", id)}
                    onAdd={() => onAddItem("account")}
                    addLabel="افزودن حساب"
                  />

                  <Dropdown
                    placeholder="دریافت در"
                    valueId={toAccountId}
                    valueLabel={accounts.find((a) => a.id === toAccountId)?.title || ""}
                    items={accounts.map((a) => ({ id: a.id, label: a.title }))}
                    onChange={(id) => setToAccountId(id)}
                    onEdit={(id) => onEditItem("account", id)}
                    onAdd={() => onAddItem("account")}
                    addLabel="افزودن حساب"
                  />
                </div>
              )}

              <button
                onClick={submit}
                disabled={!canSubmit}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
                  canSubmit ? "bg-navy-900 hover:bg-navy-700 active:bg-navy-900" : "bg-slate-300"
                }`}
              >
                ثبت
              </button>

              {!canSubmit && (
                <div className="text-[11px] text-muted">
                  {validAmount ? "فیلدهای لازم را کامل کن." : "مبلغ باید عدد مثبت باشد."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-3 py-2 font-extrabold ${
        active ? "bg-white shadow-sm ring-1 ring-black/5 text-ink" : "text-muted hover:bg-white/60"
      }`}
    >
      {children}
    </button>
  );
}

function Dropdown({
  placeholder,
  valueId,
  valueLabel,
  items,
  onChange,
  onEdit,
  onAdd,
  addLabel,
}: {
  placeholder: string;
  valueId: string;
  valueLabel: string;
  items: { id: string; label: string }[];
  onChange: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
  addLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10 text-right flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-navy-900/20"
      >
        <span className={`text-sm ${valueId ? "text-ink font-extrabold" : "text-muted"}`}>
          {valueId ? valueLabel : placeholder}
        </span>
        <span className="text-muted">▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-2xl bg-white shadow-xl ring-1 ring-black/10 overflow-hidden">
          <div className="max-h-56 overflow-auto">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between px-3 py-2 hover:bg-bg">
                <button
                  className="flex-1 text-right text-sm font-semibold text-ink"
                  onClick={() => {
                    onChange(it.id);
                    setOpen(false);
                  }}
                >
                  {it.label}
                </button>

                <button
                  className="ml-1 h-8 w-8 rounded-xl bg-bg text-navy-900 hover:bg-slate-200"
                  title="ویرایش"
                  onClick={() => onEdit(it.id)}
                >
                  ✎
                </button>
              </div>
            ))}
          </div>

          <button
            className="w-full border-t px-3 py-3 text-sm font-extrabold text-ink hover:bg-bg"
            onClick={() => {
              setOpen(false);
              onAdd();
            }}
          >
            + {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { PersianCalendar } from "../layout/Appshell";
import type { Account, Category, Tx } from "../layout/Appshell";
import { accountBalance } from "../lib/accounts";
import {
  currentJalaliMonthBounds,
  currentJalaliYearBounds,
  fullJalali,
  isBetweenISO,
  jalaliISODate,
  jalaliMonthBounds,
  jalaliParts,
  lastNDaysBounds,
  parseJalaliISODate,
  todayISO,
} from "../lib/date";

type Ctx = {
  txs: Tx[];
  categories: Category[];
  accounts: Account[];
  openEdit: (id: string) => void;
};

type RangePreset = "month" | "year" | "last30" | "custom";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(n)));
const percent = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));
const chartColors = ["#FF7A1A", "#0B1B3A", "#10B981", "#6366F1", "#F59E0B", "#334155", "#EF4444"];
const jalaliMonthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export default function ReportsPage() {
  const { txs, categories, accounts, openEdit } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const monthBounds = currentJalaliMonthBounds();
  const [preset, setPreset] = useState<RangePreset>("month");
  const [from, setFrom] = useState(monthBounds.start);
  const [to, setTo] = useState(monthBounds.end);

  useEffect(() => {
    if (searchParams.get("section") !== "accounts") return;
    const timer = window.setTimeout(() => document.getElementById("accounts-balances")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category.title])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account.title])), [accounts]);
  const categoryTitle = (id?: string) => (id ? categoryById.get(id) : undefined) || "بدون دسته‌بندی";
  const accountTitle = (id?: string) => (id ? accountById.get(id) : undefined) || "بدون حساب";

  const applyPreset = (next: RangePreset) => {
    setPreset(next);
    if (next === "month") {
      const bounds = currentJalaliMonthBounds();
      setFrom(bounds.start);
      setTo(bounds.end);
    }
    if (next === "year") {
      const bounds = currentJalaliYearBounds();
      setFrom(bounds.start);
      setTo(bounds.end);
    }
    if (next === "last30") {
      const bounds = lastNDaysBounds(30, todayISO());
      setFrom(bounds.start);
      setTo(bounds.end);
    }
  };

  const filteredTxs = useMemo(
    () => txs.filter((tx) => isBetweenISO(tx.date, from, to)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [txs, from, to]
  );

  const totals = useMemo(() => {
    return filteredTxs.reduce(
      (acc, tx) => {
        if (tx.type === "income") acc.income += tx.amountToman;
        if (tx.type === "expense") acc.expense += tx.amountToman;
        if (tx.type === "transfer") acc.transfer += tx.amountToman;
        return acc;
      },
      { income: 0, expense: 0, transfer: 0 }
    );
  }, [filteredTxs]);

  const expenseSlices = useMemo(
    () =>
      groupByLabel(
        filteredTxs.filter((tx) => tx.type === "expense"),
        (tx) => (tx.categoryId ? categoryById.get(tx.categoryId) : undefined) || "بدون دسته‌بندی"
      ),
    [filteredTxs, categoryById]
  );

  const incomeSlices = useMemo(
    () =>
      groupByLabel(
        filteredTxs.filter((tx) => tx.type === "income"),
        (tx) => (tx.categoryId ? categoryById.get(tx.categoryId) : undefined) || "بدون دسته‌بندی"
      ),
    [filteredTxs, categoryById]
  );

  const monthlySeries = useMemo(() => {
    const todayParts = jalaliParts(todayISO());
    return jalaliMonthNames.slice(0, todayParts.month).map((label, index) => {
      const bounds = jalaliMonthBounds(todayParts.year, index + 1);
      const monthTxs = txs.filter((tx) => isBetweenISO(tx.date, bounds.start, bounds.end));
      return {
        label,
        income: monthTxs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amountToman, 0),
        expense: monthTxs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amountToman, 0),
      };
    });
  }, [txs]);

  const exportExcel = () => {
    const rows = filteredTxs.map((tx) => ({
      تاریخ: jalaliISODate(tx.date),
      "تاریخ کامل": fullJalali(tx.date),
      "تاریخ میلادی": tx.date,
      نوع: tx.type === "income" ? "درآمد" : tx.type === "expense" ? "هزینه" : "جابجایی",
      مبلغ: tx.amountToman,
      دسته: tx.type === "transfer" ? "" : categoryTitle(tx.categoryId),
      "از حساب": tx.type === "expense" || tx.type === "transfer" ? accountTitle(tx.fromAccountId) : "",
      "به حساب": tx.type === "income" || tx.type === "transfer" ? accountTitle(tx.toAccountId) : "",
      شرح: tx.note ?? "",
    }));
    const emptyRow = { تاریخ: "", "تاریخ کامل": "", "تاریخ میلادی": "", نوع: "", مبلغ: "", دسته: "", "از حساب": "", "به حساب": "", شرح: "" };
    const htmlRows = rows
      .map(
        (row) =>
          `<tr>${Object.values(row)
            .map((value) => `<td>${String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const headers = Object.keys(rows[0] ?? emptyRow)
      .map((key) => `<th>${key}</th>`)
      .join("");
    const workbook = `<html dir="rtl"><head><meta charset="UTF-8" /></head><body><table><thead><tr>${headers}</tr></thead><tbody>${htmlRows}</tbody></table></body></html>`;
    const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-report-${jalaliISODate(from)}-to-${jalaliISODate(to)}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 flex items-center justify-between bg-bg/95 px-3 pt-4 pb-3 backdrop-blur sm:-mx-4 sm:px-4 sm:pt-6">
        <div className="text-sm font-semibold">گزارش</div>
        <button
          onClick={exportExcel}
          className="rounded-2xl bg-navy-900 px-3 py-2 text-xs font-extrabold text-white shadow-sm active:bg-navy-700"
        >
          خروجی اکسل
        </button>
      </div>

      <div className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg p-1 text-xs">
          <Chip active={preset === "month"} onClick={() => applyPreset("month")}>ماه جاری</Chip>
          <Chip active={preset === "year"} onClick={() => applyPreset("year")}>از ابتدای سال</Chip>
          <Chip active={preset === "last30"} onClick={() => applyPreset("last30")}>۳۰ روز اخیر</Chip>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <DateInput label="از تاریخ" value={from} onChange={(value) => { setFrom(value); setPreset("custom"); }} />
          <DateInput label="تا تاریخ" value={to} onChange={(value) => { setTo(value); setPreset("custom"); }} />
        </div>
      </div>

      <AccountsBalanceSection
        accounts={accounts}
        txs={txs}
        onTransactions={(accountId) => navigate(`/transactions?account=${encodeURIComponent(accountId)}&period=month`)}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SummaryCard title="درآمد" value={totals.income} tone="text-navy-900" />
        <SummaryCard title="هزینه" value={totals.expense} tone="text-expense" />
        <SummaryCard title="مانده" value={totals.income - totals.expense} tone="text-ink" signed />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PieChart title="هزینه‌ها" total={totals.expense} slices={expenseSlices} emptyText="هزینه‌ای در این بازه نیست." />
        <PieChart title="درآمدها" total={totals.income} slices={incomeSlices} emptyText="درآمدی در این بازه نیست." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyBarChart rows={monthlySeries} />

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-extrabold text-ink">تراکنش‌های بازه</div>
          <div className="mt-3 space-y-2">
            {filteredTxs.length === 0 ? (
              <div className="text-xs text-muted">تراکنشی برای این بازه ثبت نشده است.</div>
            ) : (
              filteredTxs.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => openEdit(tx.id)}
                  className={`flex w-full flex-col items-stretch gap-1 rounded-2xl px-3 py-2.5 text-right ring-1 ring-black/5 hover:brightness-[0.98] active:brightness-[0.97] lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:py-2 ${
                    tx.type === "income" ? "bg-emerald-50/70" : tx.type === "expense" ? "bg-orange-50/70" : "bg-bg"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-ink">
                      {tx.type === "transfer" ? `${accountTitle(tx.fromAccountId)} ← ${accountTitle(tx.toAccountId)}` : `${categoryTitle(tx.categoryId)} · ${tx.type === "income" ? accountTitle(tx.toAccountId) : accountTitle(tx.fromAccountId)}`}
                    </div>
                    <div className="truncate text-[11px] text-muted">{jalaliISODate(tx.date)} · {tx.note || fullJalali(tx.date)}</div>
                  </div>
                  <div className={`shrink-0 self-end text-sm font-extrabold lg:self-auto ${tx.type === "income" ? "text-emerald-700" : tx.type === "expense" ? "text-expense" : "text-transfer"}`}>
                    {money(tx.amountToman)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountsBalanceSection({
  accounts,
  txs,
  onTransactions,
}: {
  accounts: Account[];
  txs: Tx[];
  onTransactions: (accountId: string) => void;
}) {
  const groups: Array<{ key: NonNullable<Account["kind"]>; title: string; tone: string }> = [
    { key: "cash", title: "حساب‌های نقدی", tone: "text-emerald-700" },
    { key: "debt", title: "بدهی‌ها", tone: "text-red-700" },
    { key: "receivable", title: "طلب‌ها", tone: "text-violet-700" },
    { key: "investment", title: "سرمایه‌گذاری‌ها", tone: "text-blue-700" },
  ];

  return (
    <section id="accounts-balances" className="scroll-mt-24 space-y-3">
      <div className="flex items-end justify-between px-1">
        <div>
          <div className="text-sm font-extrabold text-ink">مانده حساب‌ها</div>
          <div className="mt-1 text-[11px] text-muted">مانده بر اساس همه تراکنش‌های ثبت‌شده</div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => {
        const rows = accounts.filter((account) => (account.kind ?? "cash") === group.key);
        if (!rows.length) return null;
        const total = rows.reduce((sum, account) => sum + accountBalance(account, txs), 0);
        return (
          <div key={group.key} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-extrabold text-ink">{group.title}</div>
              <div className={`text-sm font-extrabold ${group.tone}`}>{total < 0 ? "-" : ""}{money(total)}</div>
            </div>
            <div className="mt-3 space-y-2">
              {rows.map((account) => {
                const balance = accountBalance(account, txs);
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => onTransactions(account.id)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2 text-right transition hover:bg-slate-100 active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-ink">{account.title}</div>
                      <div className="mt-1 text-[10px] text-muted">مشاهده تراکنش‌ها</div>
                    </div>
                    <div className={`shrink-0 text-sm font-extrabold ${balance < 0 ? "text-red-700" : "text-ink"}`}>
                      {balance < 0 ? "-" : ""}{money(balance)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </section>
  );
}

function groupByLabel(txs: Tx[], labelOf: (tx: Tx) => string) {
  const map = new Map<string, number>();
  txs.forEach((tx) => map.set(labelOf(tx), (map.get(labelOf(tx)) ?? 0) + tx.amountToman));
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-2 font-bold ${active ? "bg-navy-900 text-white" : "text-ink hover:bg-white"}`}
    >
      {children}
    </button>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(jalaliISODate(value));
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    setDraft(jalaliISODate(value));
  }, [value]);

  const commit = (nextDraft: string) => {
    const parsed = parseJalaliISODate(nextDraft);
    if (parsed) onChange(parsed);
    setDraft(parsed ? jalaliISODate(parsed) : jalaliISODate(value));
  };

  return (
    <div className="relative">
      <label className="block rounded-2xl bg-bg px-3 py-2">
        <span className="text-[11px] text-muted">{label}</span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(draft);
            }}
            className="min-w-0 flex-1 bg-transparent text-xs font-extrabold text-ink outline-none"
          />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setCalendarOpen((open) => !open)}
            className="h-8 w-8 shrink-0 rounded-xl bg-white text-xs ring-1 ring-black/5"
            aria-label="انتخاب تاریخ"
            title="انتخاب تاریخ"
          >
            📅
          </button>
        </div>
      </label>

      {calendarOpen && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/25" onClick={() => setCalendarOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0">
            <div className="mx-auto max-w-[420px] px-3 sm:px-4 pb-4">
              <div className="rounded-t-3xl bg-white p-3 shadow-2xl ring-1 ring-black/10">
                <PersianCalendar
                  value={value}
                  onSelect={(next) => {
                    onChange(next);
                    setCalendarOpen(false);
                  }}
                  onClose={() => setCalendarOpen(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, tone, signed }: { title: string; value: number; tone: string; signed?: boolean }) {
  const display = signed && value < 0 ? `-${money(value)}` : money(value);
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="text-[11px] text-muted">{title}</div>
      <div className={`mt-1 text-sm font-extrabold ${tone}`}>{display}</div>
    </div>
  );
}

function PieChart({
  title,
  total,
  slices,
  emptyText,
}: {
  title: string;
  total: number;
  slices: { label: string; value: number }[];
  emptyText: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const segments = slices.reduce<{ label: string; value: number; dash: number; offset: number }[]>((acc, slice) => {
    const previousOffset = acc.reduce((sum, segment) => sum + segment.dash, 0);
    return [...acc, { ...slice, dash: total > 0 ? (slice.value / total) * circumference : 0, offset: previousOffset }];
  }, []);

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-ink">{title}</div>
        <div className="text-xs font-extrabold text-muted">{money(total)} تومان</div>
      </div>

      {total <= 0 ? (
        <div className="mt-4 text-xs text-muted">{emptyText}</div>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="18" />
            {segments.map((segment, index) => (
              <circle
                key={segment.label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={chartColors[index % chartColors.length]}
                strokeWidth="18"
                strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
                strokeDashoffset={-segment.offset}
              />
            ))}
          </svg>

          <div className="min-w-0 flex-1 space-y-2">
            {slices.slice(0, 5).map((slice, index) => (
              <div key={slice.label} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />
                  <span className="truncate font-bold text-ink">{slice.label}</span>
                </div>
                <div className="shrink-0 whitespace-nowrap text-[10px] font-bold text-muted/75">
                  {percent((slice.value / total) * 100)}٪ · {money(slice.value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthlyBarChart({ rows }: { rows: { label: string; income: number; expense: number }[] }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.income, row.expense]));

  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-ink">روند ماهانه</div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-navy-900" />درآمد</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-orange" />هزینه</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-bg px-3 py-4">
        <div className="grid h-52 items-end gap-2" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
          {rows.map((row) => {
            const incomeHeight = row.income > 0 ? Math.max(4, (row.income / max) * 150) : 2;
            const expenseHeight = row.expense > 0 ? Math.max(4, (row.expense / max) * 150) : 2;
            return (
              <div key={row.label} className="flex min-w-0 flex-col items-center justify-end gap-2">
                <div className="flex h-[150px] items-end gap-1.5">
                  <div
                    className="w-3 rounded-t-lg bg-navy-900"
                    style={{ height: `${incomeHeight}px` }}
                    title={`${row.label} درآمد ${money(row.income)}`}
                  />
                  <div
                    className="w-3 rounded-t-lg bg-orange"
                    style={{ height: `${expenseHeight}px` }}
                    title={`${row.label} هزینه ${money(row.expense)}`}
                  />
                </div>
                <div className="max-w-full truncate text-[10px] font-bold text-muted">{row.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

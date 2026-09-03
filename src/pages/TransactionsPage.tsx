import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { TransactionGroups } from "../components/TransactionCards";
import type { Tx, Account, Category } from "../layout/Appshell";
import {
  currentJalaliMonthBounds,
  currentJalaliYearBounds,
  findGregorianForJalali,
  fullJalali,
  isBetweenISO,
  jalaliISODate,
  jalaliParts,
  normalizeDigits,
  todayISO,
} from "../lib/date";

type Ctx = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  openEdit: (id: string) => void;
};

type Filter = "all" | "income" | "expense" | "transfer";
type PeriodFilter = "all" | "month" | "quarter" | "year";

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(value)));

function normalizeSearch(value: string) {
  return normalizeDigits(value).toLowerCase().replace(/[٬,،\s]+/g, " ").trim();
}

export default function TransactionsPage() {
  const { txs, accounts, categories, openEdit } = useOutletContext<Ctx>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get("type");
  const initialPeriod = searchParams.get("period");
  const [filter, setFilter] = useState<Filter>(
    initialType === "income" || initialType === "expense" || initialType === "transfer" ? initialType : "all"
  );
  const [period, setPeriod] = useState<PeriodFilter>(
    initialPeriod === "month" || initialPeriod === "quarter" || initialPeriod === "year" ? initialPeriod : "all"
  );
  const [query, setQuery] = useState("");
  const accountId = searchParams.get("account") || "";
  const categoryId = searchParams.get("category") || "";
  const fromDate = searchParams.get("from") || "";
  const toDate = searchParams.get("to") || "";
  const dateRange = useMemo(() => (fromDate && toDate ? { start: fromDate, end: toDate } : null), [fromDate, toDate]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const account = accountId ? accountById.get(accountId) : undefined;
  const category = categoryId && categoryId !== "none" ? categoryById.get(categoryId) : undefined;
  const periodBounds = useMemo(() => {
    if (period === "month") return currentJalaliMonthBounds();
    if (period === "year") return currentJalaliYearBounds();
    if (period === "quarter") {
      const today = todayISO();
      const parts = jalaliParts(today);
      const quarterStartMonth = Math.floor((parts.month - 1) / 3) * 3 + 1;
      return { start: findGregorianForJalali(parts.year, quarterStartMonth, 1), end: today };
    }
    return null;
  }, [period]);

  const updateType = (next: Filter) => {
    setFilter(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("type");
    else params.set("type", next);
    setSearchParams(params, { replace: true });
  };

  const updatePeriod = (next: PeriodFilter) => {
    setPeriod(next);
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("period");
    else params.set("period", next);
    params.delete("from");
    params.delete("to");
    setSearchParams(params, { replace: true });
  };

  const clearAccount = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("account");
    setSearchParams(params, { replace: true });
  };

  const clearCategory = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    setSearchParams(params, { replace: true });
  };

  const clearDateRange = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("from");
    params.delete("to");
    setSearchParams(params, { replace: true });
  };

  const list = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return txs.filter((tx) => {
      if (filter !== "all" && tx.type !== filter) return false;
      if (dateRange && !isBetweenISO(tx.date, dateRange.start, dateRange.end)) return false;
      if (!dateRange && periodBounds && !isBetweenISO(tx.date, periodBounds.start, periodBounds.end)) return false;
      if (accountId && tx.fromAccountId !== accountId && tx.toAccountId !== accountId) return false;
      if (categoryId === "none" && tx.categoryId) return false;
      if (categoryId && categoryId !== "none" && tx.categoryId !== categoryId) return false;
      if (!normalizedQuery) return true;

      const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
      const fromAccount = tx.fromAccountId ? accountById.get(tx.fromAccountId) : undefined;
      const toAccount = tx.toAccountId ? accountById.get(tx.toAccountId) : undefined;
      const haystack = normalizeSearch(
        [
          tx.note,
          category?.title,
          category?.icon,
          fromAccount?.title,
          toAccount?.title,
          tx.type,
          String(tx.amountToman),
          money(tx.amountToman),
          tx.date,
          jalaliISODate(tx.date),
          fullJalali(tx.date),
        ]
          .filter(Boolean)
          .join(" ")
      );
      return haystack.includes(normalizedQuery);
    });
  }, [accountById, accountId, categoryById, categoryId, dateRange, filter, periodBounds, query, txs]);

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 bg-bg/95 px-3 pt-4 pb-3 backdrop-blur sm:-mx-4 sm:px-4 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">تراکنش‌ها</div>

          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 text-xs ring-1 ring-black/5">
            <Chip active={filter === "all"} onClick={() => updateType("all")}>همه</Chip>
            <Chip active={filter === "income"} onClick={() => updateType("income")}>درآمد</Chip>
            <Chip active={filter === "expense"} onClick={() => updateType("expense")}>هزینه</Chip>
            <Chip active={filter === "transfer"} onClick={() => updateType("transfer")}>جابجایی</Chip>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 text-xs ring-1 ring-black/5">
          <Chip active={period === "all"} onClick={() => updatePeriod("all")}>همه</Chip>
          <Chip active={period === "month"} onClick={() => updatePeriod("month")}>ماه</Chip>
          <Chip active={period === "quarter"} onClick={() => updatePeriod("quarter")}>فصل</Chip>
          <Chip active={period === "year"} onClick={() => updatePeriod("year")}>سال</Chip>
        </div>

        {account && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-navy-900 px-3 py-2 text-white">
            <div className="min-w-0">
              <div className="text-[10px] text-white/60">حساب</div>
              <div className="truncate text-xs font-extrabold">{account.title}</div>
            </div>
            <button type="button" onClick={clearAccount} className="rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white">
              حذف فیلتر
            </button>
          </div>
        )}

        {categoryId && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-orange-50 px-3 py-2 text-expense ring-1 ring-orangeExpense/20">
            <div className="min-w-0">
              <div className="text-[10px] text-expense/70">دسته‌بندی هزینه</div>
              <div className="truncate text-xs font-extrabold">{categoryId === "none" ? "بدون دسته‌بندی" : category?.title || "دسته‌بندی انتخاب‌شده"}</div>
            </div>
            <button type="button" onClick={clearCategory} className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-expense ring-1 ring-orangeExpense/15">
              حذف فیلتر
            </button>
          </div>
        )}

        {dateRange && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2 text-ink ring-1 ring-black/5">
            <div className="min-w-0">
              <div className="text-[10px] text-muted">بازهٔ گزارش</div>
              <div className="truncate text-xs font-extrabold">{jalaliISODate(dateRange.start)} تا {jalaliISODate(dateRange.end)}</div>
            </div>
            <button type="button" onClick={clearDateRange} className="rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-muted ring-1 ring-black/5">
              حذف فیلتر
            </button>
          </div>
        )}

        <label className="mt-3 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
          <span className="text-sm text-muted">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجو در شرح، دسته، حساب، مبلغ یا تاریخ"
            className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none placeholder:text-muted/70"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="h-7 w-7 rounded-xl bg-bg text-muted" aria-label="پاک کردن جستجو">
              ×
            </button>
          )}
        </label>
      </div>

      <div>
        {list.length === 0 ? (
          <div className="rounded-3xl bg-white px-4 py-8 text-center text-sm font-bold text-muted shadow-sm ring-1 ring-black/5">
            نتیجه‌ای پیدا نشد.
          </div>
        ) : (
          <TransactionGroups txs={list} categories={categories} accounts={accounts} openEdit={openEdit} />
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-2 font-bold ${active ? "bg-navy-900 text-white" : "text-ink hover:bg-bg"}`}
    >
      {children}
    </button>
  );
}

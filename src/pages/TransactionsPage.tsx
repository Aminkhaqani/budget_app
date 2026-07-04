import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import { TransactionGroups } from "../components/TransactionCards";
import type { Tx, Account, Category } from "../layout/Appshell";
import { fullJalali, jalaliISODate, normalizeDigits } from "../lib/date";

type Ctx = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  openEdit: (id: string) => void;
};

type Filter = "all" | "income" | "expense" | "transfer";

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(value)));

function normalizeSearch(value: string) {
  return normalizeDigits(value).toLowerCase().replace(/[٬,،\s]+/g, " ").trim();
}

export default function TransactionsPage() {
  const { txs, accounts, categories, openEdit } = useOutletContext<Ctx>();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

  const list = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return txs.filter((tx) => {
      if (filter !== "all" && tx.type !== filter) return false;
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
  }, [accountById, categoryById, filter, query, txs]);

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 bg-bg/95 px-3 pt-4 pb-3 backdrop-blur sm:-mx-4 sm:px-4 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">تراکنش‌ها</div>

          <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 text-xs ring-1 ring-black/5">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>همه</Chip>
            <Chip active={filter === "income"} onClick={() => setFilter("income")}>درآمد</Chip>
            <Chip active={filter === "expense"} onClick={() => setFilter("expense")}>هزینه</Chip>
            <Chip active={filter === "transfer"} onClick={() => setFilter("transfer")}>جابجایی</Chip>
          </div>
        </div>

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

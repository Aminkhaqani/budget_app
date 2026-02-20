import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { shortJalali } from "../lib/date";
import type { Tx, Account, Category } from "../layout/Appshell";

type Ctx = { txs: Tx[]; accounts: Account[]; categories: Category[] };

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(n)));

type Filter = "all" | "income" | "expense" | "transfer";

export default function TransactionsPage() {
  const { txs, accounts, categories } = useOutletContext<Ctx>();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    return filter === "all" ? txs : txs.filter(t => t.type === filter);
  }, [txs, filter]);

  const accountTitle = (id?: string) => accounts.find(a => a.id === id)?.title || "—";
  const categoryTitle = (id?: string) => categories.find(c => c.id === id)?.title || "—";

  return (
    <div className="pt-4 sm:pt-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">تراکنش‌ها</div>

        <div className="rounded-2xl bg-white ring-1 ring-black/5 p-1 text-xs grid grid-cols-4 gap-1">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>همه</Chip>
          <Chip active={filter === "income"} onClick={() => setFilter("income")}>درآمد</Chip>
          <Chip active={filter === "expense"} onClick={() => setFilter("expense")}>هزینه</Chip>
          <Chip active={filter === "transfer"} onClick={() => setFilter("transfer")}>جابجایی</Chip>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {list.map((t) => {
          const color =
            t.type === "income" ? "text-ink" : t.type === "expense" ? "text-orangeExpense" : "text-slate-700";

          const title =
            t.type === "transfer"
              ? `${accountTitle(t.fromAccountId)} → ${accountTitle(t.toAccountId)}`
              : categoryTitle(t.categoryId);

          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3.5 py-3 shadow-sm ring-1 ring-black/5"
            >
              <div className="min-w-0">
                <div className="font-bold text-ink truncate">{title}</div>
                <div className="text-xs text-ink mt-0.5">{shortJalali(t.date)}</div>
              </div>

              <div className={`shrink-0 font-extrabold ${color}`}>{money(t.amountToman)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-2 font-bold ${active ? "bg-navy-900 text-white" : "text-ink hover:bg-bg"}`}
    >
      {children}
    </button>
  );
}

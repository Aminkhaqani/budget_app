import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import { shortJalali } from "../lib/date";
import type { Tx, Account, Category } from "../layout/Appshell";

type Ctx = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  openEdit: (id: string) => void;
};

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(n)));
type Filter = "all" | "income" | "expense" | "transfer";

export default function TransactionsPage() {
  const { txs, accounts, categories, openEdit } = useOutletContext<Ctx>();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    return filter === "all" ? txs : txs.filter((t) => t.type === filter);
  }, [txs, filter]);

  const accountTitle = (id?: string) => accounts.find((a) => a.id === id)?.title || "—";
  const categoryTitle = (id?: string) => categories.find((c) => c.id === id)?.title || "—";

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
          const color = t.type === "income" ? "text-emerald-700" : t.type === "expense" ? "text-orangeExpense" : "text-slate-700";
          const rowBg = t.type === "income" ? "bg-emerald-50/60" : t.type === "expense" ? "bg-orange-50/70" : "bg-white";
          const title = t.type === "transfer" ? `${accountTitle(t.fromAccountId)} ← ${accountTitle(t.toAccountId)}` : categoryTitle(t.categoryId);

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => openEdit(t.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-right shadow-sm ring-1 ring-black/5 hover:brightness-[0.98] active:brightness-[0.97] ${rowBg}`}
            >
              <div className="min-w-0">
                <div className="font-bold text-ink truncate">{title}</div>
                <div className="text-xs text-muted mt-0.5">{shortJalali(t.date)}</div>
                {t.note && <div className="mt-0.5 truncate text-[10px] text-muted">{t.note}</div>}
              </div>

              <div className={`shrink-0 font-extrabold ${color}`}>{money(t.amountToman)}</div>
            </button>
          );
        })}
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

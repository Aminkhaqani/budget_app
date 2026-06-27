import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import { TransactionGroups } from "../components/TransactionCards";
import type { Tx, Account, Category } from "../layout/Appshell";

type Ctx = {
  txs: Tx[];
  accounts: Account[];
  categories: Category[];
  openEdit: (id: string) => void;
};

type Filter = "all" | "income" | "expense" | "transfer";

export default function TransactionsPage() {
  const { txs, accounts, categories, openEdit } = useOutletContext<Ctx>();
  const [filter, setFilter] = useState<Filter>("all");

  const list = useMemo(() => {
    return filter === "all" ? txs : txs.filter((tx) => tx.type === filter);
  }, [txs, filter]);

  return (
    <div className="pt-4 sm:pt-6">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">تراکنش‌ها</div>

        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 text-xs ring-1 ring-black/5">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>همه</Chip>
          <Chip active={filter === "income"} onClick={() => setFilter("income")}>درآمد</Chip>
          <Chip active={filter === "expense"} onClick={() => setFilter("expense")}>هزینه</Chip>
          <Chip active={filter === "transfer"} onClick={() => setFilter("transfer")}>جابجایی</Chip>
        </div>
      </div>

      <div className="mt-4">
        <TransactionGroups txs={list} categories={categories} accounts={accounts} openEdit={openEdit} />
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

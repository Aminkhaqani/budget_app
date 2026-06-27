import { addDays, shortJalali, todayISO } from "../lib/date";
import type { Account, Category, Tx } from "../layout/Appshell";

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(n)));

function groupDateLabel(iso: string) {
  const today = todayISO();
  if (iso === today) return "امروز";
  if (iso === addDays(today, -1)) return "دیروز";
  return shortJalali(iso);
}

function groupByDate(txs: Tx[]) {
  const groups = new Map<string, Tx[]>();
  txs.forEach((tx) => {
    groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);
  });
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function typeLabel(type: Tx["type"]) {
  if (type === "income") return "درآمد";
  if (type === "expense") return "هزینه";
  return "جابجایی";
}

function fallbackIcon(type: Tx["type"]) {
  if (type === "income") return "↙";
  if (type === "expense") return "↗";
  return "⇄";
}

function txView(
  tx: Tx,
  categories: Category[],
  accounts: Account[]
): { icon: string; title: string; meta: string; amountTone: string; rowBg: string } {
  const category = tx.categoryId ? categories.find((item) => item.id === tx.categoryId) : undefined;
  const fromAccount = tx.fromAccountId ? accounts.find((item) => item.id === tx.fromAccountId)?.title : undefined;
  const toAccount = tx.toAccountId ? accounts.find((item) => item.id === tx.toAccountId)?.title : undefined;
  const transferTitle = fromAccount && toAccount ? `${fromAccount} ← ${toAccount}` : "جابجایی";
  const categoryTitle = category?.title ?? (tx.type === "income" ? "درآمد" : tx.type === "expense" ? "بدون دسته‌بندی" : transferTitle);

  return {
    icon: category?.icon || fallbackIcon(tx.type),
    title: tx.note?.trim() || categoryTitle,
    meta: tx.type === "transfer" ? transferTitle : categoryTitle,
    amountTone: tx.type === "income" ? "text-emerald-700" : tx.type === "expense" ? "text-orangeExpense" : "text-transfer",
    rowBg: tx.type === "income" ? "bg-emerald-50/60" : tx.type === "expense" ? "bg-orange-50/70" : "bg-white",
  };
}

export function TransactionGroups({
  txs,
  categories,
  accounts,
  openEdit,
  limit,
}: {
  txs: Tx[];
  categories: Category[];
  accounts: Account[];
  openEdit: (id: string) => void;
  limit?: number;
}) {
  const visibleTxs = limit ? txs.slice(0, limit) : txs;
  const groups = groupByDate(visibleTxs);

  return (
    <div className="space-y-4">
      {groups.map(([date, rows]) => (
        <section key={date} className="space-y-2">
          <div className="px-1 text-[11px] font-extrabold text-muted">{groupDateLabel(date)}</div>

          <div className="space-y-2">
            {rows.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                categories={categories}
                accounts={accounts}
                openEdit={openEdit}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TransactionCard({
  tx,
  categories,
  accounts,
  openEdit,
}: {
  tx: Tx;
  categories: Category[];
  accounts: Account[];
  openEdit: (id: string) => void;
}) {
  const view = txView(tx, categories, accounts);

  return (
    <button
      type="button"
      onClick={() => openEdit(tx.id)}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-3 text-right shadow-sm ring-1 ring-black/5 hover:brightness-[0.98] active:brightness-[0.97] ${view.rowBg}`}
      title="ویرایش تراکنش"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-lg shadow-sm ring-1 ring-black/5">
        {view.icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-ink">{view.title}</span>
        <span className="mt-0.5 block truncate text-[10px] font-bold text-muted">
          {view.meta} · {typeLabel(tx.type)}
        </span>
      </span>

      <span className={`shrink-0 text-sm font-extrabold ${view.amountTone}`}>
        {money(tx.amountToman)}
        <span className="mr-1 text-[10px] font-bold text-muted">تومن</span>
      </span>
    </button>
  );
}

import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { Tx, Category, Account } from "../layout/Appshell";
import { shortJalali } from "../lib/date";

type Period = "month" | "quarter" | "year";

type Ctx = {
  txs: Tx[];
  categories: Category[];
  accounts: Account[];
  openAdd: () => void;
  openEdit: (id: string) => void;
  deleteTx: (id: string) => void;
};

const money = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(n)));

function nextPeriod(p: Period): Period {
  return p === "month" ? "quarter" : p === "quarter" ? "year" : "month";
}
function periodLabel(p: Period) {
  if (p === "month") return "ماه";
  if (p === "quarter") return "فصل";
  return "سال";
}
function arrow(deltaPct: number) {
  return deltaPct >= 0 ? "↗" : "↘";
}

export default function DashboardPage() {
  const { txs, categories, accounts, openEdit, deleteTx } = useOutletContext<Ctx>();
  const [period, setPeriod] = useState<Period>("month");

  const byCatTitle = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.title));
    return map;
  }, [categories]);

  const byAccTitle = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.title));
    return map;
  }, [accounts]);

  const { income, expense } = useMemo(() => {
    const inc = txs.filter((t) => t.type === "income").reduce((a, b) => a + b.amountToman, 0);
    const exp = txs.filter((t) => t.type === "expense").reduce((a, b) => a + b.amountToman, 0);
    return { income: inc, expense: exp };
  }, [txs]);

  // placeholder previous-period values
  const { incomePrev, expensePrev } = useMemo(() => {
    const f = period === "month" ? 0.92 : period === "quarter" ? 1.08 : 0.97;
    return {
      incomePrev: Math.max(0, Math.round(income * f)),
      expensePrev: Math.max(0, Math.round(expense * (2 - f))),
    };
  }, [income, expense, period]);

  const incomeDeltaPct = incomePrev === 0 ? 0 : (income - incomePrev) / incomePrev;
  const expenseDeltaPct = expensePrev === 0 ? 0 : (expense - expensePrev) / expensePrev;

  const rowLabel = (t: Tx) => {
    if (t.type === "transfer") {
      const f = t.fromAccountId ? byAccTitle.get(t.fromAccountId) : "";
      const to = t.toAccountId ? byAccTitle.get(t.toAccountId) : "";
      return `جابجایی${f && to ? `: ${f} → ${to}` : ""}`;
    }
    if (!t.categoryId) return t.type === "income" ? "درآمد" : "هزینه";
    return byCatTitle.get(t.categoryId) ?? "بدون دسته‌بندی";
  };

  return (
<div className="pt-4 sm:pt-6 bg-bg min-h-screen">
    <div className="-mx-3 sm:-mx-4 -mt-4 sm:-mt-6 px-3 sm:px-4 pt-4 sm:pt-6 pb-6 bg-navy-900 rounded-b-[32px]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-white">Budget</div>

          <button
            onClick={() => setPeriod((p) => nextPeriod(p))}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs text-white/80 ring-1 ring-white/10 hover:bg-white/15 active:bg-white/15"
            title="با کلیک بین ماه/فصل/سال جابه‌جا می‌شود"
          >
            <span className="text-white/70">دوره:</span>
            <span className="font-extrabold text-white">{periodLabel(period)}</span>
            <span className="text-white/60">▾</span>
          </button>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <KpiCard
            variant="income"
            title="درآمد"
            value={income}
            prevValue={incomePrev}
            deltaPct={incomeDeltaPct}
            upGood
          />
          <KpiCard
            variant="expense"
            title="هزینه"
            value={expense}
            prevValue={expensePrev}
            deltaPct={expenseDeltaPct}
            upGood={false}
          />
        </div>
      </div>

      {/* Recent */}
      <div className="mt-5 flex items-center justify-between px-1">
        <h2 className="text-base font-extrabold text-ink">آخرین تراکنش‌ها</h2>
      </div>

      <div className="mt-3 space-y-2">
        {txs.slice(0, 8).map((t) => {
          const isIncome = t.type === "income";
          const isExpense = t.type === "expense";

          const rowBg = isIncome
            ? "bg-emerald-50/60"
            : isExpense
            ? "bg-orange-50/70"
            : "bg-white";

          const amountTone = isIncome
            ? "text-emerald-700"
            : isExpense
            ? "text-orangeExpense"
            : "text-transfer";

          return (
            <div
              key={t.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(t.id)}
              onKeyDown={(e) => e.key === "Enter" && openEdit(t.id)}
              className={`flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 shadow-sm ring-1 ring-black/5 cursor-pointer hover:brightness-[0.98] active:brightness-[0.97] ${rowBg}`}
              title="برای ویرایش کلیک کن"
            >
              <div className="min-w-0">
                <div className="font-extrabold text-ink truncate">
                  {rowLabel(t)}
                </div>
                <div className="text-xs text-muted mt-0.5">{shortJalali(t.date)}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className={`font-extrabold ${amountTone}`}>
                  {money(t.amountToman)} <span className="text-[11px] font-bold text-muted">تومن</span>
                </div>

                {/* Trash */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTx(t.id);
                  }}
                  className="h-9 w-9 grid place-items-center rounded-xl bg-white/70 ring-1 ring-black/5 hover:bg-white"
                  title="حذف"
                  aria-label="حذف"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  variant,
  title,
  value,
  prevValue,
  deltaPct,
  upGood,
}: {
  variant: "income" | "expense";
  title: string;
  value: number;
  prevValue: number;
  deltaPct: number;
  upGood: boolean;
}) {
  const isUp = deltaPct >= 0;
  const good = upGood ? isUp : !isUp;

  const deltaColor = good ? "text-emerald-700" : "text-red-600";
  const deltaBg = good ? "bg-emerald-50" : "bg-red-50";
  const pct = Math.abs(deltaPct) * 100;

  const cardBg = variant === "income" ? "bg-white" : "bg-white";
  const headerTint = variant === "income" ? "bg-navy-900/10" : "bg-orange-50";
  const valueTone = variant === "income" ? "text-navy-900" : "text-orangeExpense";

  return (
    <div className={`rounded-2xl ${cardBg} shadow-sm ring-1 ring-black/5 overflow-hidden`}>
      <div className={`px-4 py-3 ${headerTint}`}>
        <div className="text-xs text-muted">{title}</div>
        <div className={`mt-1 text-xl font-extrabold ${valueTone}`}>{money(value)}</div>

        <div className="mt-2 flex items-center justify-between">
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] ${deltaBg} ${deltaColor}`}>
            <span className="text-[11px]">{arrow(deltaPct)}</span>
            <span className="font-extrabold">{pct.toFixed(1)}%</span>
          </div>

          <div className="text-[10px] text-muted">
            دوره مشابه: <span className="font-extrabold">{money(prevValue)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="text-slate-700">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v10h-2V9Zm4 0h2v10h-2V9ZM7 9h2v10H7V9Zm-1 14h12a2 2 0 0 0 2-2V7H4v14a2 2 0 0 0 2 2Z"
      />
    </svg>
  );
}

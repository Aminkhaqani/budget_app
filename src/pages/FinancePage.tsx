import { useMemo, useState } from "react";
import { NavLink, useOutletContext } from "react-router-dom";
import type { Account, Category, PlannedItem, Tx } from "../layout/Appshell";
import { totalCashBalance } from "../lib/accounts";
import {
  findGregorianForJalali,
  fullJalali,
  isBetweenISO,
  jalaliISODate,
  jalaliMonthBounds,
  jalaliParts,
  normalizeDigits,
  todayISO,
} from "../lib/date";

type Ctx = {
  txs: Tx[];
  categories: Category[];
  accounts: Account[];
  plannedItems: PlannedItem[];
};

type PlannedOccurrence = PlannedItem & {
  date: string;
};

type ForecastPoint = {
  id: string;
  title: string;
  type: PlannedItem["type"];
  date: string;
  amountToman: number;
  cash: number;
};

const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(value)));
const parseAmount = (value: string) => Number(normalizeDigits(value).replace(/[^\d]/g, "")) || 0;

function formatAmountInput(value: string) {
  const parsed = parseAmount(value);
  return parsed ? new Intl.NumberFormat("en-US").format(parsed) : "";
}

function typeLabel(type: PlannedItem["type"]) {
  if (type === "income") return "درآمد";
  if (type === "must") return "پرداخت قطعی";
  return "قابل کنترل";
}

function typeTone(type: PlannedItem["type"]) {
  if (type === "income") return "bg-emerald-50 text-emerald-700";
  if (type === "must") return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-700";
}

function signedAmount(value: number) {
  if (value < 0) return `-${money(value)}`;
  return money(value);
}

function plannedDateForMonth(item: PlannedItem, year: number, month: number, maxDay: number) {
  return findGregorianForJalali(year, month, Math.min(Math.max(1, item.dayOfMonth), maxDay));
}

function buildForecast(currentCash: number, events: PlannedOccurrence[], scenarioAmount: number): ForecastPoint[] {
  let cash = currentCash;
  const rows: ForecastPoint[] = [
    {
      id: "start",
      title: "مانده امروز",
      type: "income" as const,
      date: todayISO(),
      amountToman: 0,
      cash,
    },
  ];

  const scenario: PlannedOccurrence | null = scenarioAmount
    ? {
        id: "scenario",
        title: "خرج احتمالی",
        type: "flex",
        amountToman: scenarioAmount,
        dayOfMonth: jalaliParts(todayISO()).day,
        active: true,
        date: todayISO(),
      }
    : null;

  const allEvents = [...events, ...(scenario ? [scenario] : [])].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.type === "income" ? -1 : 1)
  );

  allEvents.forEach((event) => {
    cash += event.type === "income" ? event.amountToman : -event.amountToman;
    rows.push({ ...event, cash });
  });

  return rows;
}

export default function FinancePage() {
  const { txs, categories, accounts, plannedItems } = useOutletContext<Ctx>();
  const [scenarioRaw, setScenarioRaw] = useState("5,000,000");
  const [reserveRaw, setReserveRaw] = useState("12,000,000");

  const today = todayISO();
  const todayJalali = jalaliParts(today);
  const monthBounds = jalaliMonthBounds(todayJalali.year, todayJalali.month);
  const monthLastDay = jalaliParts(monthBounds.end).day;
  const monthTxs = useMemo(
    () => txs.filter((tx) => isBetweenISO(tx.date, monthBounds.start, monthBounds.end)),
    [txs, monthBounds.end, monthBounds.start]
  );
  const currentTxs = useMemo(() => txs.filter((tx) => tx.date <= today), [txs, today]);
  const currentCash = useMemo(() => totalCashBalance(accounts, currentTxs), [accounts, currentTxs]);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const reserve = parseAmount(reserveRaw);
  const scenarioAmount = parseAmount(scenarioRaw);

  const futureEvents = useMemo<PlannedOccurrence[]>(() => {
    return plannedItems
      .filter((item) => item.active)
      .map((item) => ({
        ...item,
        date: plannedDateForMonth(item, todayJalali.year, todayJalali.month, monthLastDay),
      }))
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || b.amountToman - a.amountToman);
  }, [monthLastDay, plannedItems, today, todayJalali.month, todayJalali.year]);

  const totals = useMemo(() => {
    return futureEvents.reduce(
      (acc, item) => {
        if (item.type === "income") acc.income += item.amountToman;
        if (item.type === "must") acc.must += item.amountToman;
        if (item.type === "flex") acc.flex += item.amountToman;
        return acc;
      },
      { income: 0, must: 0, flex: 0 }
    );
  }, [futureEvents]);

  const freeCash = currentCash + totals.income - totals.must - reserve;
  const forecastRows = useMemo(() => buildForecast(currentCash, futureEvents, scenarioAmount), [currentCash, futureEvents, scenarioAmount]);
  const lowestCash = Math.min(...forecastRows.map((row) => row.cash));
  const decisionState = lowestCash < 0 ? "danger" : lowestCash < reserve ? "warning" : "safe";

  const envelopes = plannedItems
    .filter((item) => item.active && item.type === "flex")
    .map((item) => {
      const spent = monthTxs
        .filter((tx) => tx.type === "expense" && tx.categoryId === item.categoryId)
        .reduce((sum, tx) => sum + tx.amountToman, 0);
      return {
        ...item,
        spent,
        left: item.amountToman - spent,
        percent: item.amountToman > 0 ? Math.min(100, Math.round((spent / item.amountToman) * 100)) : 0,
      };
    });

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 bg-bg/95 px-3 pt-4 pb-3 backdrop-blur sm:-mx-4 sm:px-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">مدیریت مالی</div>
            <div className="mt-1 text-[11px] text-muted">از امروز تا پایان ماه شمسی</div>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to="/loans" className="rounded-2xl bg-navy-900 px-3 py-2 text-xs font-extrabold text-white shadow-sm">
              تسهیلات
            </NavLink>
            <div className="rounded-2xl bg-white px-3 py-2 text-left text-xs font-extrabold text-ink shadow-sm ring-1 ring-black/5">
              {jalaliISODate(today)}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-navy-900 p-4 text-white shadow-sm">
        <div className="text-xs text-white/70">مانده قابل تصمیم</div>
        <div className="mt-2 text-3xl font-extrabold">{signedAmount(freeCash)}</div>
        <div className="mt-2 text-[11px] text-white/65">
          مانده فعلی + ورودی‌های باقی‌مانده - پرداخت‌های قطعی - ذخیره امن
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCard title="انتظار دریافت" value={totals.income} tone="text-emerald-700" />
        <MetricCard title="پرداخت قطعی" value={totals.must} tone="text-red-700" />
        <MetricCard title="خرج قابل کنترل" value={totals.flex} tone="text-blue-700" />
        <MetricCard title="کمترین مانده" value={lowestCash} tone={lowestCash < reserve ? "text-red-700" : "text-ink"} signed />
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-ink">تست تصمیم خرج</div>
            <div className="mt-1 text-[11px] text-muted">قبل از پرداخت، اثرش را روی روزهای بعد ببین</div>
          </div>
          <DecisionBadge state={decisionState} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block rounded-2xl bg-bg px-3 py-2">
            <span className="text-[11px] text-muted">خرج احتمالی</span>
            <input
              value={scenarioRaw}
              onChange={(event) => setScenarioRaw(formatAmountInput(event.target.value))}
              inputMode="numeric"
              dir="ltr"
              className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </label>
          <label className="block rounded-2xl bg-bg px-3 py-2">
            <span className="text-[11px] text-muted">ذخیره امن</span>
            <input
              value={reserveRaw}
              onChange={(event) => setReserveRaw(formatAmountInput(event.target.value))}
              inputMode="numeric"
              dir="ltr"
              className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </label>
        </div>

        <div className={`mt-3 rounded-2xl px-3 py-3 text-xs leading-6 ${decisionCopy(decisionState).className}`}>
          <div className="font-extrabold">{decisionCopy(decisionState).title}</div>
          <div>{decisionCopy(decisionState).text}</div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-extrabold text-ink">نقشه نقدینگی</div>
          <div className="text-[11px] font-bold text-muted">تا {jalaliISODate(monthBounds.end)}</div>
        </div>
        <div className="mt-4 space-y-3">
          {forecastRows.map((row) => (
            <ForecastRow key={`${row.id}-${row.date}`} row={row} reserve={reserve} max={Math.max(...forecastRows.map((item) => item.cash), reserve, 1)} />
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="text-sm font-extrabold text-ink">برنامه‌های باقی‌مانده این ماه</div>
        <div className="mt-3 space-y-2">
          {futureEvents.length === 0 ? (
            <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">برنامه‌ای تا پایان ماه باقی نمانده.</div>
          ) : (
            futureEvents.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-ink">{item.title}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {fullJalali(item.date)} · {categoryById.get(item.categoryId ?? "")?.title ?? typeLabel(item.type)}
                  </div>
                </div>
                <div className="shrink-0 text-left">
                  <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-extrabold ${typeTone(item.type)}`}>
                    {typeLabel(item.type)}
                  </div>
                  <div className="mt-1 text-xs font-extrabold text-ink">{money(item.amountToman)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="text-sm font-extrabold text-ink">پاکت‌های خرج قابل کنترل</div>
        <div className="mt-3 space-y-3">
          {envelopes.length === 0 ? (
            <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">هنوز خرج قابل کنترل تعریف نشده.</div>
          ) : (
            envelopes.map((item) => (
              <div key={item.id} className="rounded-2xl bg-bg px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-extrabold text-ink">{item.title}</div>
                  <div className={`text-xs font-extrabold ${item.left < 0 ? "text-red-700" : "text-muted"}`}>
                    {item.left < 0 ? "کسری " : "مانده "}
                    {money(item.left)}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full ${item.percent > 90 ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${item.percent}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  خرج شده {money(item.spent)} از سقف {money(item.amountToman)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, tone, signed }: { title: string; value: number; tone: string; signed?: boolean }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="text-[11px] text-muted">{title}</div>
      <div className={`mt-1 text-sm font-extrabold ${tone}`}>{signed ? signedAmount(value) : money(value)}</div>
    </div>
  );
}

function decisionCopy(state: "safe" | "warning" | "danger") {
  if (state === "danger") {
    return {
      title: "نه، با این خرج نقدینگی منفی می‌شود.",
      text: "قبل از رسیدن یک ورودی یا کم‌کردن یک پرداخت دیگر، این تصمیم خطرناک است.",
      className: "bg-red-50 text-red-800",
    };
  }
  if (state === "warning") {
    return {
      title: "قابل انجام است، ولی از ذخیره امن پایین‌تر می‌روی.",
      text: "اگر این خرج ضروری نیست، بهتر است تا بعد از پرداخت‌های قطعی عقب بیفتد.",
      className: "bg-amber-50 text-amber-800",
    };
  }
  return {
    title: "قابل پرداخت است.",
    text: "بعد از این تصمیم همچنان بالاتر از ذخیره امن می‌مانی.",
    className: "bg-emerald-50 text-emerald-800",
  };
}

function DecisionBadge({ state }: { state: "safe" | "warning" | "danger" }) {
  const label = state === "safe" ? "اوکی" : state === "warning" ? "احتیاط" : "خطر";
  const cls = state === "safe" ? "bg-emerald-50 text-emerald-700" : state === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <div className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${cls}`}>{label}</div>;
}

function ForecastRow({
  row,
  reserve,
  max,
}: {
  row: ForecastPoint;
  reserve: number;
  max: number;
}) {
  const width = Math.max(5, Math.min(100, (Math.max(0, row.cash) / max) * 100));
  const barTone = row.cash < 0 ? "bg-red-500" : row.cash < reserve ? "bg-amber-500" : "bg-emerald-600";
  const amountPrefix = row.amountToman === 0 ? "" : row.type === "income" ? "+" : "-";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <div className="min-w-0 truncate font-extrabold text-ink">
          {row.title} <span className="font-bold text-muted">· {jalaliISODate(row.date)}</span>
        </div>
        <div className="shrink-0 font-extrabold text-muted">
          {amountPrefix}
          {row.amountToman ? money(row.amountToman) : ""}
        </div>
      </div>
      <div className="relative h-8 overflow-hidden rounded-2xl bg-bg">
        <div className={`absolute bottom-0 left-0 top-0 ${barTone}`} style={{ width: `${width}%` }} />
        <div className="relative z-10 flex h-full items-center justify-between px-3 text-[11px] font-extrabold">
          <span className="text-ink">مانده</span>
          <span className={row.cash < reserve ? "text-red-800" : "text-ink"}>{signedAmount(row.cash)}</span>
        </div>
      </div>
    </div>
  );
}

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  addDays,
  fullJalali,
  jalaliMonthBounds,
  jalaliMonthTitle,
  jalaliParts,
  jalaliDayOfWeekIndex,
  normalizeDigits,
  shiftJalaliMonth,
  shortJalali,
  todayISO,
} from "../lib/date";
import { initialAccounts, initialCategories, initialLoanInstallments, initialLoans, initialPlannedItems, initialTransactions } from "../data/initialData";
import { defaultExpenseAccount, defaultIncomeAccount } from "../lib/accounts";
import {
  deleteRemoteAccount,
  deleteRemoteCategory,
  deleteRemoteTx,
  saveRemoteAccount,
  saveRemoteCategory,
  saveRemotePlannedItem,
  saveRemoteTx,
  saveRemoteLoan,
  saveRemoteLoanInstallment,
  subscribeBudgetChanges,
  syncBudgetData,
  deleteRemotePlannedItem,
  deleteRemoteLoan,
  deleteRemoteLoanInstallment,
  getPendingBudgetOperationCount,
  getBudgetSession,
  confirmBudgetPasswordReset,
  createSupportTicket,
  ensureBudgetProfile,
  isBudgetAdmin,
  loadSupportTickets,
  requestBudgetPasswordReset,
  signInBudgetUser,
  signOutBudgetUser,
  subscribeBudgetAuth,
  subscribeBudgetQueueChanges,
  updateBudgetPassword,
} from "../lib/budgetStore";
import type { SupportTicket } from "../lib/budgetStore";
import { AccountModal, CategoryModal } from "../pages/SettingsPage";

const STORAGE_KEYS = {
  txs: "budget-app:txs:v1",
  categories: "budget-app:categories:v1",
  accounts: "budget-app:accounts:v1",
  plannedItems: "budget-app:planned-items:v1",
  loans: "budget-app:loans:v1",
  loanInstallments: "budget-app:loan-installments:v1",
};

const newCategoryDraft = (type: "income" | "expense"): Category => ({
  id: `c_${type}_${crypto.randomUUID()}`,
  type,
  title: "",
  icon: "",
  popular: false,
});

const newAccountDraft = (): Account => ({
  id: `a_${crypto.randomUUID()}`,
  title: "",
  openingBalanceToman: 0,
  bankKey: "generic",
  color: "#64748b",
  defaultForExpense: false,
  defaultForIncome: false,
});

type TxType = "income" | "expense" | "transfer";

export type Tx = {
  id: string;
  type: TxType;

  amountToman: number;
  date: string; // YYYY-MM-DD
  createdAt?: string;

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
  kind?: "cash" | "investment" | "debt" | "receivable";
  openingBalanceToman?: number;
  bankKey?: string;
  color?: string;
  defaultForExpense?: boolean;
  defaultForIncome?: boolean;
};

export type PlannedItem = {
  id: string;
  title: string;
  type: "income" | "must" | "flex";
  amountToman: number;
  dayOfMonth: number;
  active: boolean;
  categoryId?: string;
  accountId?: string;
  note?: string;
};

export type Loan = {
  id: string;
  title: string;
  lender?: string;
  principalToman: number;
  receivedDate: string;
  receivedAccountId?: string;
  active: boolean;
  note?: string;
};

export type LoanInstallment = {
  id: string;
  loanId: string;
  dueDate: string;
  amountToman: number;
  paid: boolean;
  paidAmountToman?: number;
  paidDate?: string;
  transactionId?: string;
  note?: string;
};

type SyncStatus = "idle" | "syncing" | "synced" | "pending" | "error";

type SyncState = {
  status: SyncStatus;
  pendingCount: number;
};

const NAV_ITEMS = [
  { to: "/", label: "خانه", icon: "home" },
  { to: "/transactions", label: "تراکنش‌ها", icon: "tx" },
  { to: "/finance", label: "مدیریت", icon: "finance" },
  { to: "/reports", label: "گزارش", icon: "reports" },
  { to: "/settings", label: "تنظیمات", icon: "settings" },
] as const;

const DESKTOP_NAV_ITEMS = [
  ...NAV_ITEMS,
  { to: "/loans", label: "تسهیلات", icon: "finance" },
  { to: "/customers", label: "مشتریان", icon: "settings" },
  { to: "/support", label: "پشتیبانی", icon: "tx" },
] as const;

type NavIconName = (typeof NAV_ITEMS)[number]["icon"];

function NavIcon({ name, active, mode = "dark" }: { name: NavIconName; active?: boolean; mode?: "dark" | "light" }) {
  const inactive = mode === "light" ? "text-navy-900/65" : "text-white/65";
  const common = `h-5 w-5 transition-colors duration-300 ${active ? "text-orange" : inactive}`;
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
  if (name === "finance")
    return (
      <svg viewBox="0 0 24 24" className={common}>
        <path fill="currentColor" d="M4 4h16v4H4V4Zm0 6h7v10H4V10Zm9 0h7v4h-7v-4Zm0 6h7v4h-7v-4Z" />
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
  icon: NavIconName;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] transition-colors duration-300 ${
          isActive ? "text-orange" : "text-white/65"
        }`
}
    >
      {({ isActive }) => (
        <>
          <span className={`relative z-10 grid h-11 w-11 place-items-center rounded-full transition-transform duration-300 ${isActive ? "-translate-y-0.5" : ""}`}>
            <NavIcon name={icon} active={isActive} />
          </span>
          <span className={`relative z-10 max-w-full truncate px-0.5 ${isActive ? "font-extrabold" : "font-semibold"}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function activeNavIndex(pathname: string) {
  if (pathname.startsWith("/loans")) return 2;
  const index = NAV_ITEMS.findIndex((item) => item.to === "/" ? pathname === "/" : pathname.startsWith(item.to));
  return index >= 0 ? index : 0;
}

function BottomNav({ onAdd }: { onAdd: () => void }) {
  const { pathname } = useLocation();
  const activeIndex = activeNavIndex(pathname);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="pointer-events-none mx-auto max-w-[420px] px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:px-4">
        <div className="relative pointer-events-auto">
          <button
            onClick={onAdd}
            className="absolute -top-16 right-6 z-20 grid h-14 w-14 place-items-center rounded-2xl bg-orange text-white shadow-2xl ring-1 ring-black/10 transition-transform duration-200 active:scale-95"
            aria-label="افزودن تراکنش"
            title="افزودن تراکنش"
          >
            <span className="text-3xl leading-none">+</span>
          </button>

          <div className="relative overflow-hidden rounded-3xl bg-navy-900 px-3 py-2 shadow-lg ring-1 ring-black/10">
            <div aria-hidden="true" className="absolute inset-x-3 top-1.5 h-11">
              <span
                className="absolute h-11 w-11 rounded-full bg-white shadow-sm transition-[right,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]"
                style={{ right: `calc(${activeIndex} * 20% + 10% - 1.375rem)` }}
              />
            </div>
            <div className="relative z-10 grid grid-cols-5 items-center" dir="rtl">
              {NAV_ITEMS.map((item) => (
                <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopSidebar({ onAdd, onSignOut }: { onAdd: () => void; onSignOut: () => void }) {
  return (
    <aside className="fixed bottom-0 right-0 top-0 z-40 hidden w-64 border-l border-black/5 bg-white px-4 py-6 shadow-sm lg:block">
      <div className="text-lg font-extrabold text-ink">Budget</div>
      <div className="mt-1 text-xs text-muted">مدیریت مالی شخصی</div>
      <button
        onClick={onAdd}
        className="mt-6 w-full rounded-2xl bg-orange px-4 py-3 text-sm font-extrabold text-white shadow-sm active:bg-orange/90"
      >
        + تراکنش جدید
      </button>
      <nav className="mt-6 space-y-1">
        {DESKTOP_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold transition-colors ${
                isActive ? "bg-navy-900 text-white" : "text-muted hover:bg-bg hover:text-ink"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`grid h-9 w-9 place-items-center rounded-xl ${isActive ? "bg-white/10" : "bg-bg"}`}>
                  <NavIcon name={item.icon} active={isActive} mode="light" />
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <button
        onClick={onSignOut}
        className="absolute bottom-6 left-4 right-4 rounded-2xl bg-bg px-4 py-3 text-sm font-extrabold text-muted hover:text-ink"
      >
        خروج
      </button>
    </aside>
  );
}

function SyncIndicator({ state }: { state: SyncState }) {
  if (state.status === "idle" || state.status === "synced") return null;

  const label =
    state.status === "syncing"
      ? "در حال همگام‌سازی"
      : state.status === "pending"
      ? `در صف ذخیره: ${state.pendingCount}`
      : "خطا در همگام‌سازی";

  const tone =
    state.status === "error"
      ? "bg-red-50 text-red-700 ring-red-100"
      : state.status === "pending"
      ? "bg-orange-50 text-orange ring-orange-100"
      : "bg-white/95 text-muted ring-black/10";

  return (
    <div
      className={`fixed left-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full px-3 py-1 text-[10px] font-extrabold shadow-sm ring-1 backdrop-blur ${tone}`}
      dir="rtl"
    >
      {label}
    </div>
  );
}

function AuthSplash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center text-sm font-extrabold text-muted" dir="rtl">
      در حال آماده‌سازی...
    </div>
  );
}

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [identifier, setIdentifier] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await signInBudgetUser(normalizeDigits(identifier), password);
    } catch {
      setError("ایمیل/موبایل یا رمز درست نیست.");
    } finally {
      setSubmitting(false);
    }
  };

  const requestReset = async () => {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await requestBudgetPasswordReset(resetEmail);
      setResetSent(true);
      setMessage("ایمیل بازیابی ارسال شد. اگر کد داخل ایمیل بود، اینجا وارد کن؛ اگر لینک بود، لینک را باز کن.");
    } catch {
      setError("ارسال کد بازیابی انجام نشد. ایمیل را چک کن.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReset = async () => {
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await confirmBudgetPasswordReset(resetEmail, resetToken, resetPassword);
      setMode("login");
      setIdentifier(resetEmail);
      setPassword("");
      setResetToken("");
      setResetPassword("");
      setResetSent(false);
      setMessage("رمز عوض شد. حالا وارد شو.");
    } catch {
      setError("کد یا رمز جدید معتبر نیست.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg px-4 pt-[calc(env(safe-area-inset-top)+3rem)] text-ink" dir="rtl">
      <div className="mx-auto max-w-[420px] rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="text-lg font-extrabold">{mode === "login" ? "ورود به بودجه" : "بازیابی رمز"}</div>
        <div className="mt-1 text-xs text-muted">
          {mode === "login" ? "برای ادامه وارد حساب کاربری شو." : "ایمیل را وارد کن تا کد یک‌بارمصرف بگیری."}
        </div>

        {mode === "login" ? (
          <>
            <div className="mt-6 space-y-3">
              <input
                value={identifier}
                onChange={(event) => setIdentifier(normalizeDigits(event.target.value))}
                inputMode="email"
                autoComplete="username"
                className="w-full rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                placeholder="ایمیل یا موبایل ادمین"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                placeholder="رمز"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setMode("forgot");
                setError("");
                setMessage("");
                setResetEmail(identifier.includes("@") ? identifier : "");
              }}
              className="mt-3 text-xs font-extrabold text-muted hover:text-ink"
            >
              فراموشی رمز عبور
            </button>
          </>
        ) : (
          <div className="mt-6 space-y-3">
            <input
              value={resetEmail}
              onChange={(event) => setResetEmail(normalizeDigits(event.target.value))}
              inputMode="email"
              autoComplete="email"
              className="w-full rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
              placeholder="ایمیل"
              disabled={resetSent}
            />

            {resetSent && (
              <>
                <input
                  value={resetToken}
                  onChange={(event) => setResetToken(normalizeDigits(event.target.value))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                  placeholder="کد یک‌بارمصرف"
                />
                <input
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                  placeholder="رمز جدید"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void confirmReset();
                  }}
                />
              </>
            )}
          </div>
        )}

        {error && <div className="mt-3 text-xs font-bold text-red-600">{error}</div>}
        {message && <div className="mt-3 text-xs font-bold text-emerald-700">{message}</div>}

        {mode === "login" ? (
          <button
            onClick={() => void submit()}
            disabled={submitting || !identifier.trim() || !password}
            className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
              submitting || !identifier.trim() || !password ? "bg-slate-300" : "bg-navy-900 active:bg-navy-700"
            }`}
          >
            {submitting ? "در حال ورود..." : "ورود"}
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => void (resetSent ? confirmReset() : requestReset())}
              disabled={submitting || !resetEmail.trim() || (resetSent && (!resetToken.trim() || resetPassword.length < 8))}
              className={`rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
                submitting || !resetEmail.trim() || (resetSent && (!resetToken.trim() || resetPassword.length < 8))
                  ? "bg-slate-300"
                  : "bg-navy-900 active:bg-navy-700"
              }`}
            >
              {submitting ? "در حال انجام..." : resetSent ? "ثبت رمز جدید" : "ارسال کد"}
            </button>
            <button
              onClick={() => {
                setMode("login");
                setError("");
                setMessage("");
              }}
              className="rounded-2xl bg-bg px-4 py-3 text-sm font-extrabold text-muted"
            >
              برگشت
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PasswordRecoveryScreen() {
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      await updateBudgetPassword(newPassword);
      window.history.replaceState(null, "", window.location.pathname);
      await signOutBudgetUser();
    } catch {
      setError("رمز جدید ثبت نشد. حداقل ۸ کاراکتر وارد کن.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg px-4 pt-[calc(env(safe-area-inset-top)+3rem)] text-ink" dir="rtl">
      <div className="mx-auto max-w-[420px] rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
        <div className="text-lg font-extrabold">ثبت رمز جدید</div>
        <div className="mt-1 text-xs text-muted">رمز جدیدت را وارد کن، بعد دوباره وارد اپ شو.</div>

        <input
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          type="password"
          autoComplete="new-password"
          className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          placeholder="رمز جدید"
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
        />

        {error && <div className="mt-3 text-xs font-bold text-red-600">{error}</div>}

        <button
          onClick={() => void submit()}
          disabled={submitting || newPassword.length < 8}
          className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
            submitting || newPassword.length < 8 ? "bg-slate-300" : "bg-navy-900 active:bg-navy-700"
          }`}
        >
          {submitting ? "در حال ثبت..." : "ثبت رمز جدید"}
        </button>
      </div>
    </div>
  );
}

function supportCategoryLabel(category: SupportTicket["category"]) {
  if (category === "bug") return "باگ";
  if (category === "improvement") return "پیشنهاد بهبود";
  if (category === "error") return "خطا";
  if (category === "question") return "سوال";
  return "سایر";
}

function supportStatusLabel(status: SupportTicket["status"]) {
  if (status === "open") return "باز";
  if (status === "in_progress") return "در حال بررسی";
  if (status === "resolved") return "حل‌شده";
  return "بسته";
}

function CustomerPortal() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<SupportTicket["category"]>("bug");
  const [priority, setPriority] = useState<SupportTicket["priority"]>("normal");
  const [body, setBody] = useState("");
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => {
    setLoading(true);
    loadSupportTickets()
      .then(setTickets)
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const submit = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const ticket = await createSupportTicket({
        subject: subject.trim(),
        category,
        priority,
        body: body.trim(),
      });
      setTickets((current) => [ticket, ...current]);
      setSubject("");
      setBody("");
      setCategory("bug");
      setPriority("normal");
      setMessage("تیکت ثبت شد.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg px-4 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] text-ink" dir="rtl">
      <div className="mx-auto max-w-[520px] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold">تماس با پشتیبانی</div>
            <div className="mt-1 text-xs text-muted">باگ، خطا، پیشنهاد یا هر مورد لازم را ثبت کن.</div>
          </div>
          <button onClick={() => void signOutBudgetUser()} className="rounded-2xl bg-white px-4 py-2 text-xs font-extrabold text-muted ring-1 ring-black/5">
            خروج
          </button>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-extrabold">تیکت جدید</div>
          <div className="mt-3 space-y-3">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-2xl bg-bg px-4 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
              placeholder="موضوع"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as SupportTicket["category"])}
                className="rounded-2xl bg-bg px-3 py-3 text-sm font-bold text-ink ring-1 ring-black/5 outline-none"
              >
                <option value="bug">باگ</option>
                <option value="improvement">پیشنهاد بهبود</option>
                <option value="error">خطا</option>
                <option value="question">سوال</option>
                <option value="other">سایر</option>
              </select>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as SupportTicket["priority"])}
                className="rounded-2xl bg-bg px-3 py-3 text-sm font-bold text-ink ring-1 ring-black/5 outline-none"
              >
                <option value="normal">معمولی</option>
                <option value="high">مهم</option>
                <option value="low">کم‌اهمیت</option>
              </select>
            </div>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={5}
              className="w-full resize-none rounded-2xl bg-bg px-4 py-3 text-sm leading-7 ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
              placeholder="شرح کامل مورد"
            />
            {message && <div className="text-xs font-bold text-emerald-700">{message}</div>}
            <button
              onClick={() => void submit()}
              disabled={submitting || !subject.trim() || !body.trim()}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
                submitting || !subject.trim() || !body.trim() ? "bg-slate-300" : "bg-navy-900 active:bg-navy-700"
              }`}
            >
              {submitting ? "در حال ثبت..." : "ثبت تیکت"}
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <div className="text-sm font-extrabold">تیکت‌های من</div>
          <div className="mt-3 space-y-2">
            {loading ? (
              <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">در حال دریافت...</div>
            ) : tickets.length === 0 ? (
              <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">هنوز تیکتی ثبت نشده.</div>
            ) : (
              tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl bg-bg px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-ink">{ticket.subject}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        {supportCategoryLabel(ticket.category)} · {supportStatusLabel(ticket.status)}
                      </div>
                    </div>
                    <div className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-extrabold text-muted ring-1 ring-black/5">
                      {ticket.priority === "high" ? "مهم" : ticket.priority === "low" ? "کم" : "معمولی"}
                    </div>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs leading-6 text-muted">{ticket.body}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDayLabel(iso: string) {
  const t = todayISO();
  if (iso === t) return "امروز";
  return shortJalali(iso);
}

/** "1234567" -> "1,234,567" */
function formatDigitsWithSep(raw: string) {
  const digits = normalizeDigits(raw).replace(/[^\d]/g, "");
  if (!digits) return "";
  const normalized = String(Number(digits));
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function parseSepNumber(s: string) {
  const digits = normalizeDigits(s).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function normalizeAmountInput(s: string) {
  return normalizeDigits(s).replace(/[^\d,]/g, "");
}

function loadStoredArray<T>(key: string, fallback: T[]) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function sortTxs(txs: Tx[]) {
  return [...txs].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
      b.id.localeCompare(a.id)
  );
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
  const routeLocation = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const syncInFlightRef = useRef(false);
  const syncAgainRef = useRef(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  const [syncState, setSyncState] = useState<SyncState>(() => ({
    status: navigator.onLine ? "idle" : "pending",
    pendingCount: getPendingBudgetOperationCount(),
  }));

  const [txs, setTxs] = useState<Tx[]>(() =>
    sortTxs(loadStoredArray<Tx>(STORAGE_KEYS.txs, initialTransactions))
  );
  const [categories, setCategories] = useState<Category[]>(() =>
    loadStoredArray<Category>(STORAGE_KEYS.categories, initialCategories)
  );
  const [accounts, setAccounts] = useState<Account[]>(() => loadStoredArray<Account>(STORAGE_KEYS.accounts, initialAccounts));
  const [plannedItems, setPlannedItems] = useState<PlannedItem[]>(() =>
    loadStoredArray<PlannedItem>(STORAGE_KEYS.plannedItems, initialPlannedItems)
  );
  const [loans, setLoans] = useState<Loan[]>(() => loadStoredArray<Loan>(STORAGE_KEYS.loans, initialLoans));
  const [loanInstallments, setLoanInstallments] = useState<LoanInstallment[]>(() =>
    loadStoredArray<LoanInstallment>(STORAGE_KEYS.loanInstallments, initialLoanInstallments)
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.txs, JSON.stringify(txs));
  }, [txs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.plannedItems, JSON.stringify(plannedItems));
  }, [plannedItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.loans, JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.loanInstallments, JSON.stringify(loanInstallments));
  }, [loanInstallments]);

  const applyRemoteData = useCallback((remote: { txs: Tx[]; categories: Category[]; accounts: Account[]; plannedItems: PlannedItem[]; loans: Loan[]; loanInstallments: LoanInstallment[] } | null) => {
    if (!remote) return;
    setCategories(remote.categories);
    setAccounts(remote.accounts);
    setTxs(sortTxs(remote.txs));
    setPlannedItems(remote.plannedItems);
    setLoans(remote.loans);
    setLoanInstallments(remote.loanInstallments);
  }, []);

  const refreshPendingQueue = useCallback(() => {
    const pendingCount = getPendingBudgetOperationCount();
    setSyncState((current) => ({
      status: pendingCount ? "pending" : current.status === "pending" ? "idle" : current.status,
      pendingCount,
    }));
  }, []);

  const runSync = useCallback(async () => {
    if (syncInFlightRef.current) {
      syncAgainRef.current = true;
      return;
    }

    syncInFlightRef.current = true;

    try {
      do {
        syncAgainRef.current = false;
        const pendingBefore = getPendingBudgetOperationCount();

        if (!session) {
          setSyncState({ status: pendingBefore ? "pending" : "idle", pendingCount: pendingBefore });
          return;
        }

        if (!navigator.onLine) {
          setSyncState({ status: pendingBefore ? "pending" : "idle", pendingCount: pendingBefore });
          return;
        }

        setSyncState({ status: "syncing", pendingCount: pendingBefore });
        const remote = await syncBudgetData();
        const pendingAfter = getPendingBudgetOperationCount();

        if (remote) {
          applyRemoteData(remote);
          setSyncState({ status: pendingAfter ? "pending" : "synced", pendingCount: pendingAfter });
        } else {
          setSyncState({ status: pendingAfter ? "pending" : "error", pendingCount: pendingAfter });
        }
      } while (syncAgainRef.current);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [applyRemoteData, session]);

  const persistRemote = useCallback(
    (operation: Promise<unknown>) => {
      refreshPendingQueue();
      void operation
        .catch(() => {
          const pendingCount = getPendingBudgetOperationCount();
          setSyncState((current) => ({
            status: pendingCount ? "pending" : "error",
            pendingCount: pendingCount || current.pendingCount,
          }));
        })
        .finally(() => {
          refreshPendingQueue();
          void runSync();
        });
    },
    [refreshPendingQueue, runSync]
  );

  useEffect(() => {
    getBudgetSession()
      .then((currentSession) => {
        setSession(currentSession);
        if (currentSession) void ensureBudgetProfile(currentSession);
        setAuthLoading(false);
      })
      .catch(() => {
        setSession(null);
        setAuthLoading(false);
      });

    return subscribeBudgetAuth((nextSession, event) => {
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      setSession(nextSession);
      if (nextSession) void ensureBudgetProfile(nextSession);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    runSync().then(() => undefined);
  }, [runSync, session]);

  useEffect(() => {
    const resync = () => {
      void runSync();
    };
    const interval = window.setInterval(() => {
      if (!navigator.onLine || document.visibilityState !== "visible") return;
      resync();
    }, 5000);
    window.addEventListener("online", resync);
    window.addEventListener("focus", resync);
    document.addEventListener("visibilitychange", resync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", resync);
      window.removeEventListener("focus", resync);
      document.removeEventListener("visibilitychange", resync);
    };
  }, [runSync]);

  useEffect(() => {
    let syncTimeout: number | undefined;
    const resyncSoon = () => {
      window.clearTimeout(syncTimeout);
      syncTimeout = window.setTimeout(() => {
        if (!navigator.onLine) return;
        void runSync();
      }, 250);
    };
    const unsubscribe = subscribeBudgetChanges(resyncSoon);
    return () => {
      window.clearTimeout(syncTimeout);
      unsubscribe();
    };
  }, [runSync]);

  useEffect(() => subscribeBudgetQueueChanges((pendingCount) => {
    setSyncState((current) => ({
      status: pendingCount ? "pending" : current.status === "pending" ? "idle" : current.status,
      pendingCount,
    }));
  }), []);

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
    persistRemote(deleteRemoteTx(id));
    if (editingId === id) {
      setAddOpen(false);
      setEditingId(null);
    }
  };

  const editingTx = editingId ? txs.find((t) => t.id === editingId) ?? null : null;

  const upsertTx = (payload: Omit<Tx, "id">) => {
    if (editingId) {
      const currentTx = txs.find((t) => t.id === editingId);
      const nextTx = { ...payload, id: editingId, createdAt: currentTx?.createdAt ?? new Date().toISOString() };
      setTxs((prev) =>
        prev
          .map((t) => (t.id === editingId ? nextTx : t))
          .sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
              b.id.localeCompare(a.id)
          )
      );
      persistRemote(saveRemoteTx(nextTx));
      return;
    }
    const nextTx = { ...payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setTxs((prev) =>
      sortTxs([nextTx, ...prev])
    );
    persistRemote(saveRemoteTx(nextTx));
  };

  const saveCategory = (category: Category) => {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === category.id);
      return exists ? prev.map((c) => (c.id === category.id ? category : c)) : [...prev, category];
    });
    persistRemote(saveRemoteCategory(category));
  };

  const deleteCategory = (id: string, targetCategoryId?: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setTxs((prev) =>
      prev.map((t) => (t.categoryId === id ? { ...t, categoryId: targetCategoryId || undefined } : t))
    );
    persistRemote(deleteRemoteCategory(id, targetCategoryId));
  };

  const saveAccount = (account: Account) => {
    const nextAccount = {
      ...account,
      title: account.title.trim(),
      openingBalanceToman: Number(account.openingBalanceToman) || 0,
      kind: account.kind ?? "cash",
      bankKey: account.bankKey || "generic",
      defaultForExpense: !!account.defaultForExpense,
      defaultForIncome: !!account.defaultForIncome,
    };
    const merged = accounts.some((a) => a.id === nextAccount.id)
      ? accounts.map((a) => (a.id === nextAccount.id ? nextAccount : a))
      : [...accounts, nextAccount];
    const nextAccounts = merged.map((item) => ({
      ...item,
      defaultForExpense: nextAccount.defaultForExpense && item.id !== nextAccount.id ? false : !!item.defaultForExpense,
      defaultForIncome: nextAccount.defaultForIncome && item.id !== nextAccount.id ? false : !!item.defaultForIncome,
    }));
    setAccounts(nextAccounts);
    nextAccounts
      .filter((item) => item.id === nextAccount.id || item.defaultForExpense !== accounts.find((a) => a.id === item.id)?.defaultForExpense || item.defaultForIncome !== accounts.find((a) => a.id === item.id)?.defaultForIncome)
      .forEach((item) => persistRemote(saveRemoteAccount(item)));
  };

  const deleteAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setTxs((prev) => prev.map((t) => ({
        ...t,
        fromAccountId: t.fromAccountId === id ? undefined : t.fromAccountId,
        toAccountId: t.toAccountId === id ? undefined : t.toAccountId,
      })));
    persistRemote(deleteRemoteAccount(id));
  };

  const savePlannedItem = (item: PlannedItem) => {
    setPlannedItems((prev) => {
      const exists = prev.some((current) => current.id === item.id);
      return exists ? prev.map((current) => (current.id === item.id ? item : current)) : [...prev, item];
    });
    persistRemote(saveRemotePlannedItem(item));
  };

  const deletePlannedItem = (id: string) => {
    setPlannedItems((prev) => prev.filter((item) => item.id !== id));
    persistRemote(deleteRemotePlannedItem(id));
  };

  const saveLoan = (loan: Loan) => {
    setLoans((prev) => {
      const exists = prev.some((current) => current.id === loan.id);
      return exists ? prev.map((current) => (current.id === loan.id ? loan : current)) : [...prev, loan];
    });
    persistRemote(saveRemoteLoan(loan));
  };

  const deleteLoan = (id: string) => {
    setLoans((prev) => prev.filter((loan) => loan.id !== id));
    setLoanInstallments((prev) => prev.filter((installment) => installment.loanId !== id));
    persistRemote(deleteRemoteLoan(id));
  };

  const saveLoanInstallment = (installment: LoanInstallment) => {
    setLoanInstallments((prev) => {
      const exists = prev.some((current) => current.id === installment.id);
      return exists ? prev.map((current) => (current.id === installment.id ? installment : current)) : [...prev, installment];
    });
    persistRemote(saveRemoteLoanInstallment(installment));
  };

  const saveLoanWithInstallments = (loan: Loan, installments: LoanInstallment[]) => {
    saveLoan(loan);
    setLoanInstallments((prev) => {
      const others = prev.filter((item) => item.loanId !== loan.id);
      return [...others, ...installments];
    });
    installments.forEach((installment) => persistRemote(saveRemoteLoanInstallment(installment)));
  };

  const saveLoanReceipt = (loan: Loan, installments: LoanInstallment[], destinationAccountId: string) => {
    const loanAccount: Account = {
      id: `loan_account_${loan.id}`,
      title: `تسهیلات · ${loan.title}`,
      kind: "debt",
      openingBalanceToman: 0,
      bankKey: "generic",
      color: "#7c3aed",
    };
    saveAccount(loanAccount);
    saveLoanWithInstallments(loan, installments);
    upsertTx({
      type: "transfer",
      amountToman: loan.principalToman,
      date: loan.receivedDate,
      fromAccountId: loanAccount.id,
      toAccountId: destinationAccountId,
      note: `دریافت تسهیلات · ${loan.title}`,
    });
  };

  const deleteLoanInstallment = (id: string) => {
    setLoanInstallments((prev) => prev.filter((item) => item.id !== id));
    persistRemote(deleteRemoteLoanInstallment(id));
  };

  if (authLoading) return <AuthSplash />;
  if (passwordRecovery && session) return <PasswordRecoveryScreen />;
  if (!session) return <LoginScreen />;
  if (!isBudgetAdmin(session)) return <CustomerPortal />;

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <SyncIndicator state={syncState} />
      <DesktopSidebar onAdd={openAdd} onSignOut={() => void signOutBudgetUser()} />
      <div className="mx-auto min-h-dvh max-w-[420px] px-3 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-4 lg:mr-64 lg:max-w-6xl lg:px-8 lg:pb-8 lg:pt-6">
        <div key={routeLocation.pathname} className="route-transition">
          <Outlet
            context={{
              txs,
              categories,
              accounts,
              plannedItems,
              loans,
              loanInstallments,
              openAdd,
              openEdit,
              deleteTx,
              saveCategory,
              deleteCategory,
              saveAccount,
              deleteAccount,
              savePlannedItem,
              deletePlannedItem,
              saveLoan,
              deleteLoan,
              saveLoanInstallment,
              saveLoanWithInstallments,
              saveLoanReceipt,
              deleteLoanInstallment,
            }}
          />
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav onAdd={openAdd} />
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
          onSaveCategory={saveCategory}
          onSaveAccount={saveAccount}
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
  onSaveCategory,
  onSaveAccount,
}: {
  categories: Category[];
  accounts: Account[];
  initialTx: Tx | null;
  onClose: () => void;
  onSubmit: (tx: Omit<Tx, "id">) => void;
  onDelete: () => void;
  onSaveCategory: (category: Category) => void;
  onSaveAccount: (account: Account) => void;
}) {
  const [type, setType] = useState<TxType>(initialTx?.type ?? "expense");
  const [amountRaw, setAmountRaw] = useState<string>(initialTx ? String(initialTx.amountToman) : "");
  const [date, setDate] = useState<string>(initialTx?.date ?? todayISO());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [note, setNote] = useState<string>(initialTx?.note ?? "");

  const [categoryId, setCategoryId] = useState<string>(initialTx?.categoryId ?? "");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState<string>(initialTx?.fromAccountId ?? (!initialTx ? defaultExpenseAccount(accounts)?.id ?? "" : ""));
  const [toAccountId, setToAccountId] = useState<string>(initialTx?.toAccountId ?? (!initialTx ? defaultIncomeAccount(accounts)?.id ?? "" : ""));
  const [categoryDraft, setCategoryDraft] = useState<Category | null>(null);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);
  const [accountTarget, setAccountTarget] = useState<"from" | "to" | null>(null);

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

  useEffect(() => {
    if (type === "expense" && !fromAccountId) setFromAccountId(defaultExpenseAccount(accounts)?.id ?? "");
    if (type === "income" && !toAccountId) setToAccountId(defaultIncomeAccount(accounts)?.id ?? "");
    if (type === "transfer") {
      if (!fromAccountId) setFromAccountId(defaultExpenseAccount(accounts)?.id ?? "");
      if (!toAccountId) setToAccountId(accounts.find((account) => account.id !== fromAccountId)?.id ?? "");
    }
  }, [accounts, fromAccountId, toAccountId, type]);

  const canSubmit =
    validAmount &&
    (type === "transfer"
      ? fromAccountId && toAccountId && fromAccountId !== toAccountId
      : !!categoryId && (type === "income" ? !!toAccountId : !!fromAccountId));

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
      fromAccountId: type === "expense" ? fromAccountId : undefined,
      toAccountId: type === "income" ? toAccountId : undefined,
      note: note.trim() || undefined,
    });
  };

  const openCategoryForm = (id?: string) => {
    const existing = id ? categories.find((category) => category.id === id) : undefined;
    setCategoryPickerOpen(false);
    setCategoryDraft(existing ?? newCategoryDraft(type === "income" ? "income" : "expense"));
  };

  const openAccountForm = (id?: string, target: "from" | "to" | null = null) => {
    const existing = id ? accounts.find((account) => account.id === id) : undefined;
    setAccountTarget(target);
    setAccountDraft(existing ?? newAccountDraft());
  };

  const submitCategoryDraft = () => {
    if (!categoryDraft?.title.trim()) return;
    const next = {
      ...categoryDraft,
      title: categoryDraft.title.trim(),
      icon: categoryDraft.icon?.trim() || undefined,
    };
    onSaveCategory(next);
    setCategoryId(next.id);
    setCategoryDraft(null);
  };

  const submitAccountDraft = () => {
    if (!accountDraft?.title.trim()) return;
    const next = {
      ...accountDraft,
      title: accountDraft.title.trim(),
      openingBalanceToman: Number(accountDraft.openingBalanceToman) || 0,
      kind: accountDraft.kind ?? "cash",
      bankKey: accountDraft.bankKey || "generic",
      color: accountDraft.color,
      defaultForExpense: !!accountDraft.defaultForExpense,
      defaultForIncome: !!accountDraft.defaultForIncome,
    };
    onSaveAccount(next);
    if (accountTarget === "to") setToAccountId(next.id);
    else if (accountTarget === "from") setFromAccountId(next.id);
    else if (!fromAccountId) setFromAccountId(next.id);
    else if (!toAccountId && fromAccountId !== next.id) setToAccountId(next.id);
    setAccountDraft(null);
    setAccountTarget(null);
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-3 top-[24dvh] lg:inset-0 lg:grid lg:place-items-center">
        <div className="mx-auto flex h-full max-w-[420px] px-3 sm:px-4 lg:h-auto lg:w-[520px] lg:max-w-none">
          <div className="flex max-h-full w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 lg:max-h-[90vh]">
            <div className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
              <div className="font-extrabold text-ink">
                {initialTx ? "ویرایش تراکنش" : "ثبت تراکنش جدید"}
              </div>

              <div className="flex items-center gap-2">
                {initialTx && (
                  <button
                    onClick={() => {
                      if (!window.confirm("این تراکنش حذف شود؟")) return;
                      onDelete();
                      onClose();
                    }}
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                  onChange={(e) => setAmountRaw(normalizeAmountInput(e.target.value))}
                  onBlur={() => setAmountRaw((value) => formatDigitsWithSep(value))}
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
                  onClick={() => setCalendarOpen(true)}
                  className="mr-2 h-9 w-9 rounded-xl bg-bg hover:bg-slate-200"
                  aria-label="تقویم"
                  title="تقویم"
                >
                  📅
                </button>
              </div>

              {calendarOpen && (
                <PersianCalendar
                  value={date}
                  onSelect={(nextDate) => {
                    setDate(nextDate);
                    setCalendarOpen(false);
                  }}
                  onClose={() => setCalendarOpen(false)}
                />
              )}

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
                  <button
                    type="button"
                    onClick={() => setCategoryPickerOpen(true)}
                    className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                  >
                    <span className={`flex min-w-0 items-center gap-2 text-sm ${categoryId ? "font-extrabold text-ink" : "text-muted"}`}>
                      {categoryId && <span className="text-lg">{catsOfType.find((c) => c.id === categoryId)?.icon || "•"}</span>}
                      <span className="truncate">{catsOfType.find((c) => c.id === categoryId)?.title || "انتخاب دسته‌بندی"}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-navy-900">انتخاب</span>
                  </button>

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

                  <Dropdown
                    placeholder={type === "income" ? "دریافت در حساب" : "پرداخت از حساب"}
                    valueId={type === "income" ? toAccountId : fromAccountId}
                    valueLabel={accounts.find((a) => a.id === (type === "income" ? toAccountId : fromAccountId))?.title || ""}
                    items={accounts.map((a) => ({ id: a.id, label: a.title }))}
                    onChange={(id) => (type === "income" ? setToAccountId(id) : setFromAccountId(id))}
                    onEdit={(id) => openAccountForm(id, type === "income" ? "to" : "from")}
                    onAdd={() => openAccountForm(undefined, type === "income" ? "to" : "from")}
                    addLabel="افزودن حساب"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Dropdown
                    placeholder="پرداخت از"
                    valueId={fromAccountId}
                    valueLabel={accounts.find((a) => a.id === fromAccountId)?.title || ""}
                    items={accounts.map((a) => ({ id: a.id, label: a.title }))}
                    onChange={(id) => setFromAccountId(id)}
                    onEdit={(id) => openAccountForm(id, "from")}
                    onAdd={() => openAccountForm(undefined, "from")}
                    addLabel="افزودن حساب"
                  />

                  <Dropdown
                    placeholder="دریافت در"
                    valueId={toAccountId}
                    valueLabel={accounts.find((a) => a.id === toAccountId)?.title || ""}
                    items={accounts.map((a) => ({ id: a.id, label: a.title }))}
                    onChange={(id) => setToAccountId(id)}
                    onEdit={(id) => openAccountForm(id, "to")}
                    onAdd={() => openAccountForm(undefined, "to")}
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

      {categoryDraft && (
        <CategoryModal
          value={categoryDraft}
          onChange={setCategoryDraft}
          onClose={() => setCategoryDraft(null)}
          onSubmit={submitCategoryDraft}
        />
      )}

      {categoryPickerOpen && (
        <CategoryPicker
          categories={catsOfType}
          selectedId={categoryId}
          onClose={() => setCategoryPickerOpen(false)}
          onSelect={(id) => {
            setCategoryId(id);
            setCategoryPickerOpen(false);
          }}
          onEdit={openCategoryForm}
          onAdd={() => openCategoryForm()}
        />
      )}

      {accountDraft && (
        <AccountModal
          value={accountDraft}
          onChange={setAccountDraft}
          onClose={() => {
            setAccountDraft(null);
            setAccountTarget(null);
          }}
          onSubmit={submitAccountDraft}
        />
      )}
    </div>
  );
}

function CategoryPicker({
  categories,
  selectedId,
  onClose,
  onSelect,
  onEdit,
  onAdd,
}: {
  categories: Category[];
  selectedId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => searchRef.current?.focus(), 150);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const normalizedQuery = query.trim().toLocaleLowerCase("fa");
  const filtered = categories.filter((category) =>
    category.title.toLocaleLowerCase("fa").includes(normalizedQuery),
  );
  const ordered = [...filtered].sort((a, b) => Number(b.popular) - Number(a.popular));

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="انتخاب دسته‌بندی">
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="بستن انتخاب دسته‌بندی" />

      <div className="absolute inset-x-0 bottom-0 flex max-h-[82dvh] min-h-[68dvh] flex-col rounded-t-3xl bg-white shadow-2xl sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-[520px] sm:rounded-3xl lg:inset-0 lg:m-auto lg:h-[min(720px,82vh)] lg:min-h-0">
        <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-base font-extrabold text-ink">انتخاب دسته‌بندی</div>
              <div className="mt-0.5 text-[11px] text-muted">{categories.length.toLocaleString("fa-IR")} دسته‌بندی</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-xl bg-bg text-lg text-muted hover:bg-slate-200"
              aria-label="بستن"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-bg px-3 ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-navy-900/20">
            <span className="text-muted" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
              type="search"
              inputMode="search"
              placeholder="جست‌وجوی دسته‌بندی"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {ordered.length ? (
            <div className="space-y-1">
              {ordered.map((category) => {
                const selected = category.id === selectedId;
                return (
                  <div
                    key={category.id}
                    className={`flex min-h-14 items-center gap-2 rounded-2xl px-2 transition-colors ${
                      selected ? "bg-orange-50 ring-1 ring-orangeExpense/20" : "hover:bg-bg"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(category.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2 text-right"
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl ${selected ? "bg-white" : "bg-bg"}`}>
                        {category.icon || "•"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold text-ink">{category.title}</span>
                        {category.popular && <span className="mt-0.5 block text-[10px] text-muted">پرکاربرد</span>}
                      </span>
                      {selected && <span className="shrink-0 text-sm font-extrabold text-orangeExpense">✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(category.id)}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-navy-900 hover:bg-white"
                      aria-label={`ویرایش ${category.title}`}
                      title="ویرایش"
                    >
                      ✎
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid h-full min-h-40 place-items-center px-6 text-center">
              <div>
                <div className="font-extrabold text-ink">دسته‌بندی پیدا نشد</div>
                <div className="mt-1 text-xs text-muted">نام دیگری جست‌وجو کن یا دسته‌بندی تازه بساز.</div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-b-3xl">
          <button
            type="button"
            onClick={onAdd}
            className="h-12 w-full rounded-2xl bg-navy-900 px-4 text-sm font-extrabold text-white hover:bg-navy-700 active:bg-navy-900"
          >
            + افزودن دسته‌بندی جدید
          </button>
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
  children: ReactNode;
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

export function PersianCalendar({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (iso: string) => void;
  onClose: () => void;
}) {
  const selected = jalaliParts(value);
  const [view, setView] = useState({ year: selected.year, month: selected.month });
  const monthBounds = jalaliMonthBounds(view.year, view.month);
  const firstWeekday = jalaliDayOfWeekIndex(monthBounds.start);
  const leading = firstWeekday === 6 ? 0 : firstWeekday + 1;
  const days: string[] = [];

  for (let iso = monthBounds.start; iso <= monthBounds.end; iso = addDays(iso, 1)) {
    days.push(iso);
  }

  const goMonth = (delta: number) => {
    setView((current) => shiftJalaliMonth(current.year, current.month, delta));
  };

  return (
    <div className="rounded-3xl bg-bg p-3 ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goMonth(-1)}
          className="h-9 w-9 rounded-xl bg-white text-navy-900 ring-1 ring-black/5 hover:bg-slate-100"
          aria-label="ماه قبل"
          title="ماه قبل"
        >
          ‹
        </button>

        <div className="text-center">
          <div className="text-sm font-extrabold text-ink">{jalaliMonthTitle(view.year, view.month)}</div>
          <div className="text-[11px] text-muted">{fullJalali(value)}</div>
        </div>

        <button
          type="button"
          onClick={() => goMonth(1)}
          className="h-9 w-9 rounded-xl bg-white text-navy-900 ring-1 ring-black/5 hover:bg-slate-100"
          aria-label="ماه بعد"
          title="ماه بعد"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-muted">
        {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {Array.from({ length: leading }).map((_, index) => (
          <div key={`empty-${index}`} className="h-9" />
        ))}

        {days.map((iso) => {
          const day = jalaliParts(iso).day;
          const isSelected = iso === value;
          const isToday = iso === todayISO();

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              className={`h-9 rounded-xl font-extrabold ${
                isSelected
                  ? "bg-navy-900 text-white"
                  : isToday
                  ? "bg-orange-soft text-orange"
                  : "bg-white text-ink hover:bg-slate-100"
              }`}
              title={fullJalali(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onSelect(todayISO())}
          className="rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-ink ring-1 ring-black/5 hover:bg-slate-100"
        >
          امروز
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl bg-white px-3 py-2 text-xs font-extrabold text-muted ring-1 ring-black/5 hover:bg-slate-100"
        >
          بستن
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { fullJalali, jalaliISODate, normalizeDigits } from "../lib/date";
import type { Account, Category, PlannedItem, Tx } from "../layout/Appshell";
import { BANK_OPTIONS, BankLogo, bankLabel } from "../components/BankLogo";
import { accountBalance, totalCashBalance } from "../lib/accounts";

type Ctx = {
  txs: Tx[];
  categories: Category[];
  accounts: Account[];
  plannedItems: PlannedItem[];
  saveCategory: (category: Category) => void;
  deleteCategory: (id: string, targetCategoryId?: string) => void;
  saveAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  savePlannedItem: (item: PlannedItem) => void;
  deletePlannedItem: (id: string) => void;
  openEdit: (id: string) => void;
};

type Tab = "categories" | "accounts" | "plans";

const emptyCategory = (): Category => ({
  id: "",
  type: "expense",
  title: "",
  icon: "",
  popular: false,
});

const emptyAccount = (): Account => ({
  id: "",
  title: "",
  kind: "cash",
  openingBalanceToman: 0,
  bankKey: "generic",
  defaultForExpense: false,
  defaultForIncome: false,
});
const ACCOUNT_KIND_OPTIONS: Array<{ key: NonNullable<Account["kind"]>; label: string; tone: string }> = [
  { key: "cash", label: "نقدی", tone: "bg-emerald-50 text-emerald-700" },
  { key: "investment", label: "سرمایه‌گذاری", tone: "bg-blue-50 text-blue-700" },
  { key: "debt", label: "بدهی", tone: "bg-red-50 text-red-700" },
  { key: "receivable", label: "طلب", tone: "bg-violet-50 text-violet-700" },
];
const emptyPlannedItem = (): PlannedItem => ({
  id: "",
  title: "",
  type: "must",
  amountToman: 0,
  dayOfMonth: 1,
  active: true,
});
const parseAmount = (value: string) => Number(normalizeDigits(value).replace(/[^\d]/g, "")) || 0;
const money = (value: number) => new Intl.NumberFormat("fa-IR").format(Math.abs(Math.round(value)));
function accountKindLabel(kind?: Account["kind"]) {
  return ACCOUNT_KIND_OPTIONS.find((option) => option.key === (kind ?? "cash"))?.label ?? "نقدی";
}

function accountKindTone(kind?: Account["kind"]) {
  return ACCOUNT_KIND_OPTIONS.find((option) => option.key === (kind ?? "cash"))?.tone ?? "bg-emerald-50 text-emerald-700";
}

export default function SettingsPage() {
  const {
    txs,
    categories,
    accounts,
    plannedItems,
    saveCategory,
    deleteCategory,
    saveAccount,
    deleteAccount,
    savePlannedItem,
    deletePlannedItem,
    openEdit,
  } = useOutletContext<Ctx>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTabState] = useState<Tab>(initialTab === "accounts" || initialTab === "plans" ? initialTab : "categories");
  const [categoryDraft, setCategoryDraft] = useState<Category | null>(null);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);
  const [plannedDraft, setPlannedDraft] = useState<PlannedItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  const setTab = (next: Tab) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams);
    if (next === "categories") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const categoryUsage = (categoryId: string) => txs.filter((tx) => tx.categoryId === categoryId).length;
  const categoryTxs = (categoryId: string) =>
    txs
      .filter((tx) => tx.categoryId === categoryId)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || b.id.localeCompare(a.id));
  const categoryTotal = (categoryId: string) => categoryTxs(categoryId).reduce((sum, tx) => sum + tx.amountToman, 0);

  const submitCategory = (category: Category) => {
    const title = category.title.trim();
    if (!title) return;
    saveCategory({
      ...category,
      id: category.id || `c_${category.type}_${crypto.randomUUID()}`,
      title,
      icon: category.icon?.trim() || undefined,
    });
    setCategoryDraft(null);
  };

  const submitAccount = (account: Account) => {
    const title = account.title.trim();
    if (!title) return;
    saveAccount({
      ...account,
      id: account.id || `a_${crypto.randomUUID()}`,
      title,
      openingBalanceToman: Number(account.openingBalanceToman) || 0,
      kind: account.kind ?? "cash",
      bankKey: account.bankKey || "generic",
      color: account.color,
      defaultForExpense: !!account.defaultForExpense,
      defaultForIncome: !!account.defaultForIncome,
    });
    setAccountDraft(null);
  };

  const submitPlannedItem = (item: PlannedItem) => {
    const title = item.title.trim();
    if (!title || item.amountToman <= 0) return;
    savePlannedItem({
      ...item,
      id: item.id || `plan_${crypto.randomUUID()}`,
      title,
      dayOfMonth: Math.min(31, Math.max(1, Math.round(item.dayOfMonth || 1))),
      categoryId: item.categoryId || undefined,
      accountId: item.accountId || undefined,
      note: item.note?.trim() || undefined,
    });
    setPlannedDraft(null);
  };

  const requestDeleteCategory = (category: Category) => {
    if (categoryUsage(category.id) === 0) {
      setDeleteCandidate(category);
      return;
    }
    setDeleteCandidate(category);
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 bg-bg/95 px-3 pt-4 pb-3 backdrop-blur sm:-mx-4 sm:px-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">تنظیمات</div>
          <div className="rounded-2xl bg-white p-1 text-xs ring-1 ring-black/5">
            <Chip active={tab === "categories"} onClick={() => setTab("categories")}>دسته‌بندی‌ها</Chip>
            <Chip active={tab === "accounts"} onClick={() => setTab("accounts")}>حساب‌ها</Chip>
            <Chip active={tab === "plans"} onClick={() => setTab("plans")}>برنامه‌ها</Chip>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          if (tab === "categories") setCategoryDraft(emptyCategory());
          else if (tab === "accounts") setAccountDraft(emptyAccount());
          else setPlannedDraft(emptyPlannedItem());
        }}
        className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm active:bg-navy-700"
      >
        {tab === "categories" ? "ایجاد دسته‌بندی جدید" : tab === "accounts" ? "ایجاد حساب جدید" : "ایجاد برنامه جدید"}
      </button>

      {tab === "categories" ? (
        <>
          <Section title="هزینه‌ها">
            {categories.filter((c) => c.type === "expense").map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                usage={categoryUsage(category.id)}
                totalAmount={categoryTotal(category.id)}
                onOpen={() => setSelectedCategory(category)}
                onEdit={() => setCategoryDraft(category)}
                onDelete={() => requestDeleteCategory(category)}
              />
            ))}
          </Section>

          <Section title="درآمدها">
            {categories.filter((c) => c.type === "income").map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                usage={categoryUsage(category.id)}
                totalAmount={categoryTotal(category.id)}
                onOpen={() => setSelectedCategory(category)}
                onEdit={() => setCategoryDraft(category)}
                onDelete={() => requestDeleteCategory(category)}
              />
            ))}
          </Section>
        </>
      ) : tab === "accounts" ? (
        <Section title="حساب‌ها">
          <div className="mb-3 rounded-2xl bg-navy-900 px-3 py-3 text-white">
            <div className="text-[11px] text-white/65">مانده نقد کل</div>
            <div className="mt-1 text-xl font-extrabold">{money(totalCashBalance(accounts, txs))}</div>
            <div className="mt-1 text-[10px] font-bold text-white/50">فقط حساب‌های نقدی لحاظ شده‌اند</div>
          </div>
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              balance={accountBalance(account, txs)}
              onTransactions={() => navigate(`/transactions?account=${encodeURIComponent(account.id)}&period=month`)}
              onEdit={() => setAccountDraft(account)}
              onDelete={() => {
                if (window.confirm("این حساب حذف شود؟")) deleteAccount(account.id);
              }}
            />
          ))}
        </Section>
      ) : (
        <Section title="پرداخت‌ها و درآمدهای برنامه‌ای">
          {plannedItems.length === 0 ? (
            <div className="rounded-2xl bg-bg px-3 py-3 text-xs text-muted">هنوز برنامه‌ای تعریف نشده.</div>
          ) : (
            plannedItems.map((item) => (
              <PlannedItemRow
                key={item.id}
                item={item}
                categories={categories}
                onEdit={() => setPlannedDraft(item)}
                onDelete={() => {
                  if (window.confirm("این برنامه حذف شود؟")) deletePlannedItem(item.id);
                }}
              />
            ))
          )}
        </Section>
      )}

      {categoryDraft && (
        <CategoryModal
          value={categoryDraft}
          onChange={setCategoryDraft}
          onClose={() => setCategoryDraft(null)}
          onSubmit={() => submitCategory(categoryDraft)}
        />
      )}

      {accountDraft && (
        <AccountModal
          value={accountDraft}
          txs={txs}
          onChange={setAccountDraft}
          onClose={() => setAccountDraft(null)}
          onSubmit={() => submitAccount(accountDraft)}
        />
      )}

      {plannedDraft && (
        <PlannedItemModal
          value={plannedDraft}
          categories={categories}
          accounts={accounts}
          onChange={setPlannedDraft}
          onClose={() => setPlannedDraft(null)}
          onSubmit={() => submitPlannedItem(plannedDraft)}
        />
      )}

      {selectedCategory && (
        <CategoryTransactionsModal
          category={selectedCategory}
          txs={categoryTxs(selectedCategory.id)}
          onClose={() => setSelectedCategory(null)}
          onOpenTx={(id) => {
            setSelectedCategory(null);
            openEdit(id);
          }}
        />
      )}

      {deleteCandidate && (
        <DeleteCategoryModal
          category={deleteCandidate}
          usage={categoryUsage(deleteCandidate.id)}
          alternatives={categories.filter((c) => c.type === deleteCandidate.type && c.id !== deleteCandidate.id)}
          onClose={() => setDeleteCandidate(null)}
          onDelete={(targetCategoryId) => {
            deleteCategory(deleteCandidate.id, targetCategoryId);
            setDeleteCandidate(null);
          }}
        />
      )}
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="text-sm font-extrabold text-ink">{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function CategoryRow({
  category,
  usage,
  totalAmount,
  onOpen,
  onEdit,
  onDelete,
}: {
  category: Category;
  usage: number;
  totalAmount: number;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-bg px-2 py-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-right active:bg-white/70">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-lg shadow-sm ring-1 ring-black/5">
          {category.icon || "•"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-ink">{category.title}</span>
          <span className="block truncate text-[11px] text-muted">
            {category.popular ? "پرکاربرد" : "معمولی"} · {new Intl.NumberFormat("fa-IR").format(usage)} تراکنش · {money(totalAmount)}
          </span>
          <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-navy-900 ring-1 ring-black/5">
            مشاهده تراکنش‌ها
          </span>
        </span>
      </button>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function CategoryTransactionsModal({
  category,
  txs,
  onClose,
  onOpenTx,
}: {
  category: Category;
  txs: Tx[];
  onClose: () => void;
  onOpenTx: (id: string) => void;
}) {
  const total = txs.reduce((sum, tx) => sum + tx.amountToman, 0);
  const latest = txs[0]?.date;
  const tone = category.type === "income" ? "text-emerald-700 bg-emerald-50" : "text-orangeExpense bg-orange-50";

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="تراکنش‌های دسته‌بندی" onClose={onClose} />
      <div className="space-y-3">
        <div className="rounded-3xl bg-bg p-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xl ${tone}`}>
              {category.icon || "•"}
            </span>
            <div className="min-w-0">
              <div className="truncate text-base font-extrabold text-ink">{category.title}</div>
              <div className="text-[11px] font-bold text-muted">{money(txs.length)} تراکنش ثبت‌شده</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
              <div className="text-[10px] text-muted">مجموع</div>
              <div className="mt-1 text-sm font-extrabold text-ink">{money(total)}</div>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2 ring-1 ring-black/5">
              <div className="text-[10px] text-muted">آخرین تراکنش</div>
              <div className="mt-1 text-xs font-extrabold text-ink">{latest ? jalaliISODate(latest) : "ندارد"}</div>
            </div>
          </div>
        </div>

        {txs.length === 0 ? (
          <div className="rounded-2xl bg-bg px-3 py-4 text-center text-xs text-muted">هنوز تراکنشی برای این دسته ثبت نشده.</div>
        ) : (
          <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
            {txs.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => onOpenTx(tx.id)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-right ring-1 ring-black/5 active:bg-bg"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-ink">{tx.note || fullJalali(tx.date)}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted">{jalaliISODate(tx.date)}</div>
                </div>
                <div className={`shrink-0 text-sm font-extrabold ${category.type === "income" ? "text-emerald-700" : "text-orangeExpense"}`}>
                  {money(tx.amountToman)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function AccountRow({
  account,
  balance,
  onTransactions,
  onEdit,
  onDelete,
}: {
  account: Account;
  balance: number;
  onTransactions: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-3">
      <BankLogo account={account} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-extrabold text-ink">{account.title}</div>
          <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${accountKindTone(account.kind)}`}>{accountKindLabel(account.kind)}</span>
          {account.defaultForExpense && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-extrabold text-orange">هزینه</span>}
          {account.defaultForIncome && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">درآمد</span>}
        </div>
        <div className={`mt-1 text-xs font-extrabold ${balance < 0 ? "text-red-700" : "text-ink"}`}>مانده فعلی: {balance < 0 ? "-" : ""}{money(balance)}</div>
        <div className="text-[11px] text-muted">موجودی اولیه: {new Intl.NumberFormat("fa-IR").format(account.openingBalanceToman ?? 0)}</div>
        <button
          type="button"
          onClick={onTransactions}
          className="mt-2 rounded-xl bg-white px-3 py-1.5 text-[11px] font-extrabold text-navy-900 shadow-sm ring-1 ring-black/5 active:bg-slate-50"
        >
          تراکنش‌ها
        </button>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function plannedTypeLabel(type: PlannedItem["type"]) {
  if (type === "income") return "درآمد ثابت";
  if (type === "must") return "پرداخت قطعی";
  return "خرج قابل کنترل";
}

function plannedTypeTone(type: PlannedItem["type"]) {
  if (type === "income") return "text-emerald-700 bg-emerald-50";
  if (type === "must") return "text-red-700 bg-red-50";
  return "text-blue-700 bg-blue-50";
}

function PlannedItemRow({
  item,
  categories,
  onEdit,
  onDelete,
}: {
  item: PlannedItem;
  categories: Category[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = item.categoryId ? categories.find((entry) => entry.id === item.categoryId) : undefined;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-ink">{item.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
          <span className={`rounded-full px-2 py-0.5 font-extrabold ${plannedTypeTone(item.type)}`}>
            {plannedTypeLabel(item.type)}
          </span>
          <span>روز {new Intl.NumberFormat("fa-IR").format(item.dayOfMonth)} هر ماه</span>
          {category && <span>· {category.title}</span>}
          {!item.active && <span>· غیرفعال</span>}
        </div>
      </div>
      <div className="shrink-0 text-left">
        <div className="mb-1 text-xs font-extrabold text-ink">
          {new Intl.NumberFormat("fa-IR").format(item.amountToman)}
        </div>
        <RowActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button onClick={onEdit} className="h-9 w-9 rounded-xl bg-white text-navy-900 ring-1 ring-black/5" title="ویرایش">
        ✎
      </button>
      <button onClick={onDelete} className="h-9 w-9 rounded-xl bg-white text-orangeExpense ring-1 ring-black/5" title="حذف">
        ×
      </button>
    </div>
  );
}

function ModalShell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-3 top-[24dvh] lg:inset-0 lg:grid lg:place-items-center">
        <div className="mx-auto flex h-full max-w-[420px] px-3 sm:px-4 lg:h-auto lg:w-[520px] lg:max-w-none">
          <div className="max-h-full w-full overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5 lg:max-h-[90vh]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-sm font-extrabold text-ink">{title}</div>
      <button onClick={onClose} className="h-9 w-9 rounded-xl bg-bg text-muted" title="بستن" aria-label="بستن">
        ×
      </button>
    </div>
  );
}

export function CategoryModal({
  value,
  onChange,
  onClose,
  onSubmit,
}: {
  value: Category;
  onChange: (value: Category) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title={value.id ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"} onClose={onClose} />
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input
            value={value.icon ?? ""}
            onChange={(e) => onChange({ ...value, icon: e.target.value })}
            placeholder="آیکن"
            className="rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
          />
          <input
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
            placeholder="نام دسته"
            className="col-span-2 rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-bg p-1 text-xs">
          <Chip active={value.type === "expense"} onClick={() => onChange({ ...value, type: "expense" })}>
            هزینه
          </Chip>
          <Chip active={value.type === "income"} onClick={() => onChange({ ...value, type: "income" })}>
            درآمد
          </Chip>
          <button
            onClick={() => onChange({ ...value, popular: !value.popular })}
            className={`rounded-xl px-2 py-2 font-bold ${value.popular ? "bg-orange-soft text-orange" : "text-ink hover:bg-white"}`}
          >
            پرکاربرد
          </button>
        </div>

        <button onClick={onSubmit} className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
          ذخیره
        </button>
      </div>
    </ModalShell>
  );
}

export function AccountModal({
  value,
  txs,
  onChange,
  onClose,
  onSubmit,
}: {
  value: Account;
  txs?: Tx[];
  onChange: (value: Account) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const movementBalance = accountBalance({ ...value, openingBalanceToman: 0 }, txs ?? []);
  const [balanceDraft, setBalanceDraft] = useState(String((value.openingBalanceToman ?? 0) + movementBalance));
  const enteredBalance = parseAmount(balanceDraft);

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title={value.id ? "ویرایش حساب" : "حساب جدید"} onClose={onClose} />
      <div className="space-y-3">
        <div className="rounded-3xl bg-bg p-3 ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <BankLogo account={value} size="lg" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-ink">{value.title || "حساب جدید"}</div>
              <div className="mt-1 text-[11px] text-muted">{bankLabel(value.bankKey)} · {accountKindLabel(value.kind)}</div>
            </div>
          </div>
        </div>
        <input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="نام حساب"
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
        />
        <select
          value={value.bankKey ?? "generic"}
          onChange={(event) => onChange({ ...value, bankKey: event.target.value })}
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm font-bold text-ink ring-1 ring-black/5 outline-none"
        >
          {BANK_OPTIONS.map((bank) => (
            <option key={bank.key} value={bank.key}>
              {bank.label}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-bg p-1 text-xs">
          {ACCOUNT_KIND_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange({ ...value, kind: option.key })}
              className={`rounded-xl px-2 py-2 font-bold ${
                (value.kind ?? "cash") === option.key ? option.tone : "text-ink hover:bg-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-bg p-1 text-xs">
          <button
            type="button"
            onClick={() => onChange({ ...value, defaultForExpense: !value.defaultForExpense })}
            className={`rounded-xl px-2 py-2 font-bold ${value.defaultForExpense ? "bg-orange-soft text-orange" : "text-ink hover:bg-white"}`}
          >
            پیش‌فرض هزینه
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...value, defaultForIncome: !value.defaultForIncome })}
            className={`rounded-xl px-2 py-2 font-bold ${value.defaultForIncome ? "bg-emerald-50 text-emerald-700" : "text-ink hover:bg-white"}`}
          >
            پیش‌فرض درآمد
          </button>
        </div>
        <div className="rounded-2xl bg-orange-50 px-3 py-3 text-[11px] leading-6 text-orange-900">
          <div className="font-extrabold">موجودی فعلی واقعی حساب</div>
          <div className="mt-1 text-orange-900/75">اگر مانده بانک را می‌دانی، همین‌جا وارد کن. مانده اولیه به‌صورت خودکار تنظیم می‌شود تا مانده نهایی دقیقاً با آن برابر شود.</div>
          <input
            value={balanceDraft}
            onChange={(e) => {
              const nextBalance = parseAmount(e.target.value);
              setBalanceDraft(e.target.value);
              onChange({ ...value, openingBalanceToman: nextBalance - movementBalance });
            }}
            inputMode="numeric"
            placeholder="مثلاً ۲٬۰۰۰٬۰۰۰"
            className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm text-ink ring-1 ring-orange-200 outline-none focus:ring-2 focus:ring-orange-300"
          />
          <div className="mt-2 flex items-center justify-between text-[10px] text-orange-900/70">
            <span>گردش ثبت‌شده: {money(movementBalance)}</span>
            <span>مانده اولیه جدید: {money(enteredBalance - movementBalance)}</span>
          </div>
        </div>
        <button onClick={onSubmit} className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
          ذخیره
        </button>
      </div>
    </ModalShell>
  );
}

function PlannedItemModal({
  value,
  categories,
  accounts,
  onChange,
  onClose,
  onSubmit,
}: {
  value: PlannedItem;
  categories: Category[];
  accounts: Account[];
  onChange: (value: PlannedItem) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [amountDraft, setAmountDraft] = useState(value.amountToman ? new Intl.NumberFormat("en-US").format(value.amountToman) : "");
  const matchingCategories = categories.filter((category) =>
    value.type === "income" ? category.type === "income" : category.type === "expense"
  );

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title={value.id ? "ویرایش برنامه" : "برنامه جدید"} onClose={onClose} />
      <div className="space-y-3">
        <input
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
          placeholder="عنوان برنامه"
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
        />

        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-bg p-1 text-xs">
          <Chip active={value.type === "income"} onClick={() => onChange({ ...value, type: "income", categoryId: "" })}>
            درآمد
          </Chip>
          <Chip active={value.type === "must"} onClick={() => onChange({ ...value, type: "must", categoryId: "" })}>
            قطعی
          </Chip>
          <Chip active={value.type === "flex"} onClick={() => onChange({ ...value, type: "flex", categoryId: "" })}>
            قابل کنترل
          </Chip>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block rounded-2xl bg-bg px-3 py-2">
            <span className="text-[11px] text-muted">مبلغ</span>
            <input
              value={amountDraft}
              onChange={(event) => {
                const amount = parseAmount(event.target.value);
                setAmountDraft(amount ? new Intl.NumberFormat("en-US").format(amount) : "");
                onChange({ ...value, amountToman: amount });
              }}
              inputMode="numeric"
              dir="ltr"
              className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </label>

          <label className="block rounded-2xl bg-bg px-3 py-2">
            <span className="text-[11px] text-muted">روز ماه شمسی</span>
            <input
              value={value.dayOfMonth}
              onChange={(event) => onChange({ ...value, dayOfMonth: parseAmount(event.target.value) })}
              inputMode="numeric"
              className="mt-1 w-full bg-transparent text-sm font-extrabold text-ink outline-none"
            />
          </label>
        </div>

        <select
          value={value.categoryId ?? ""}
          onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm font-bold text-ink ring-1 ring-black/5 outline-none"
        >
          <option value="">بدون دسته‌بندی</option>
          {matchingCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ""}
              {category.title}
            </option>
          ))}
        </select>

        <select
          value={value.accountId ?? ""}
          onChange={(event) => onChange({ ...value, accountId: event.target.value })}
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm font-bold text-ink ring-1 ring-black/5 outline-none"
        >
          <option value="">بدون حساب مشخص</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.title}
            </option>
          ))}
        </select>

        <input
          value={value.note ?? ""}
          onChange={(event) => onChange({ ...value, note: event.target.value })}
          placeholder="توضیح اختیاری"
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
        />

        <button
          type="button"
          onClick={() => onChange({ ...value, active: !value.active })}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold ${
            value.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-muted"
          }`}
        >
          {value.active ? "فعال است" : "غیرفعال است"}
        </button>

        <button onClick={onSubmit} className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
          ذخیره
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteCategoryModal({
  category,
  usage,
  alternatives,
  onClose,
  onDelete,
}: {
  category: Category;
  usage: number;
  alternatives: Category[];
  onClose: () => void;
  onDelete: (targetCategoryId?: string) => void;
}) {
  const [mode, setMode] = useState<"uncategorized" | "move">("uncategorized");
  const [targetId, setTargetId] = useState(alternatives[0]?.id ?? "");
  const canConfirm = mode === "uncategorized" || !!targetId;

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="حذف دسته‌بندی" onClose={onClose} />
      <div className="space-y-3">
        <div className="rounded-2xl bg-bg px-3 py-3 text-xs leading-6 text-muted">
          دسته‌بندی «{category.title}» در {new Intl.NumberFormat("fa-IR").format(usage)} تراکنش استفاده شده. قبل از حذف مشخص کن تراکنش‌ها چه شوند.
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-bg p-1 text-xs">
          <Chip active={mode === "uncategorized"} onClick={() => setMode("uncategorized")}>
            بدون دسته‌بندی
          </Chip>
          <Chip active={mode === "move"} onClick={() => setMode("move")}>
            انتقال به دسته دیگر
          </Chip>
        </div>

        {mode === "move" && (
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="w-full rounded-2xl bg-bg px-3 py-3 text-sm font-bold text-ink ring-1 ring-black/5 outline-none"
          >
            {alternatives.length === 0 ? (
              <option value="">دسته‌بندی هم‌نوعی وجود ندارد</option>
            ) : (
              alternatives.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.icon ? `${item.icon} ` : ""}
                  {item.title}
                </option>
              ))
            )}
          </select>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-bg px-4 py-3 text-sm font-extrabold text-muted"
          >
            لغو
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onDelete(mode === "move" ? targetId : undefined)}
            className={`rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
              canConfirm ? "bg-orangeExpense" : "bg-slate-300"
            }`}
          >
            تایید حذف
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

import { useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import { normalizeDigits } from "../lib/date";
import type { Account, Category, Tx } from "../layout/Appshell";

type Ctx = {
  txs: Tx[];
  categories: Category[];
  accounts: Account[];
  saveCategory: (category: Category) => void;
  deleteCategory: (id: string, targetCategoryId?: string) => void;
  saveAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
};

type Tab = "categories" | "accounts";

const emptyCategory = (): Category => ({
  id: "",
  type: "expense",
  title: "",
  icon: "",
  popular: false,
});

const emptyAccount = (): Account => ({ id: "", title: "", openingBalanceToman: 0 });

const parseAmount = (value: string) => Number(normalizeDigits(value).replace(/[^\d]/g, "")) || 0;

export default function SettingsPage() {
  const { txs, categories, accounts, saveCategory, deleteCategory, saveAccount, deleteAccount } = useOutletContext<Ctx>();
  const [tab, setTab] = useState<Tab>("categories");
  const [categoryDraft, setCategoryDraft] = useState<Category | null>(null);
  const [accountDraft, setAccountDraft] = useState<Account | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Category | null>(null);

  const categoryUsage = (categoryId: string) => txs.filter((tx) => tx.categoryId === categoryId).length;

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
    });
    setAccountDraft(null);
  };

  const requestDeleteCategory = (category: Category) => {
    if (categoryUsage(category.id) === 0) {
      if (window.confirm("این دسته‌بندی حذف شود؟")) deleteCategory(category.id);
      return;
    }
    setDeleteCandidate(category);
  };

  return (
    <div className="pt-4 sm:pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">تنظیمات</div>
        <div className="rounded-2xl bg-white p-1 text-xs ring-1 ring-black/5">
          <Chip active={tab === "categories"} onClick={() => setTab("categories")}>دسته‌بندی‌ها</Chip>
          <Chip active={tab === "accounts"} onClick={() => setTab("accounts")}>حساب‌ها</Chip>
        </div>
      </div>

      <button
        onClick={() => (tab === "categories" ? setCategoryDraft(emptyCategory()) : setAccountDraft(emptyAccount()))}
        className="w-full rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white shadow-sm active:bg-navy-700"
      >
        {tab === "categories" ? "ایجاد دسته‌بندی جدید" : "ایجاد حساب جدید"}
      </button>

      {tab === "categories" ? (
        <>
          <Section title="هزینه‌ها">
            {categories.filter((c) => c.type === "expense").map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                usage={categoryUsage(category.id)}
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
                onEdit={() => setCategoryDraft(category)}
                onDelete={() => requestDeleteCategory(category)}
              />
            ))}
          </Section>
        </>
      ) : (
        <Section title="حساب‌ها">
          {accounts.map((account) => (
            <AccountRow
              key={account.id}
              account={account}
              onEdit={() => setAccountDraft(account)}
              onDelete={() => {
                if (window.confirm("این حساب حذف شود؟")) deleteAccount(account.id);
              }}
            />
          ))}
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
          onChange={setAccountDraft}
          onClose={() => setAccountDraft(null)}
          onSubmit={() => submitAccount(accountDraft)}
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
  onEdit,
  onDelete,
}: {
  category: Category;
  usage: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-ink">
          {category.icon ? `${category.icon} ` : ""}
          {category.title}
        </div>
        <div className="text-[11px] text-muted">
          {category.popular ? "پرکاربرد" : "معمولی"} · {new Intl.NumberFormat("fa-IR").format(usage)} تراکنش
        </div>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function AccountRow({ account, onEdit, onDelete }: { account: Account; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-ink">{account.title}</div>
        <div className="text-[11px] text-muted">موجودی اولیه: {new Intl.NumberFormat("fa-IR").format(account.openingBalanceToman ?? 0)}</div>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
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
      <div className="absolute bottom-0 left-0 right-0">
        <div className="mx-auto max-w-[420px] px-3 sm:px-4 pb-4">
          <div className="max-h-[82vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
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
  onChange,
  onClose,
  onSubmit,
}: {
  value: Account;
  onChange: (value: Account) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [balanceDraft, setBalanceDraft] = useState(String(value.openingBalanceToman ?? 0));

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title={value.id ? "ویرایش حساب" : "حساب جدید"} onClose={onClose} />
      <div className="space-y-3">
        <input
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="نام حساب"
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
        />
        <input
          value={balanceDraft}
          onChange={(e) => {
            setBalanceDraft(e.target.value);
            onChange({ ...value, openingBalanceToman: parseAmount(e.target.value) });
          }}
          inputMode="numeric"
          placeholder="موجودی اولیه"
          className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
        />
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
  const canMove = mode === "uncategorized" || !!targetId;

  return (
    <ModalShell onClose={onClose}>
      <ModalHeader title="حذف دسته‌بندی" onClose={onClose} />
      <div className="space-y-3">
        <div className="rounded-2xl bg-bg px-3 py-3 text-xs leading-6 text-muted">
          این دسته‌بندی در {new Intl.NumberFormat("fa-IR").format(usage)} تراکنش استفاده شده. قبل از حذف مشخص کن تراکنش‌ها چه شوند.
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

        <button
          disabled={!canMove}
          onClick={() => onDelete(mode === "move" ? targetId : undefined)}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-white ${
            canMove ? "bg-orangeExpense" : "bg-slate-300"
          }`}
        >
          حذف {category.title}
        </button>
      </div>
    </ModalShell>
  );
}

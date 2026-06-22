import { useState } from "react";
import type { ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import type { Account, Category } from "../layout/Appshell";

type Ctx = {
  categories: Category[];
  accounts: Account[];
  saveCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;
  saveAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
};

type Tab = "categories" | "accounts";

export default function SettingsPage() {
  const { categories, accounts, saveCategory, deleteCategory, saveAccount, deleteAccount } = useOutletContext<Ctx>();
  const [tab, setTab] = useState<Tab>("categories");
  const [categoryDraft, setCategoryDraft] = useState<Category>({
    id: "",
    type: "expense",
    title: "",
    icon: "",
    popular: false,
  });
  const [accountDraft, setAccountDraft] = useState<Account>({ id: "", title: "", openingBalanceToman: 0 });

  const resetCategory = () => setCategoryDraft({ id: "", type: "expense", title: "", icon: "", popular: false });
  const resetAccount = () => setAccountDraft({ id: "", title: "", openingBalanceToman: 0 });

  const submitCategory = () => {
    const title = categoryDraft.title.trim();
    if (!title) return;
    saveCategory({
      ...categoryDraft,
      id: categoryDraft.id || `c_${categoryDraft.type}_${crypto.randomUUID()}`,
      title,
      icon: categoryDraft.icon?.trim() || undefined,
    });
    resetCategory();
  };

  const submitAccount = () => {
    const title = accountDraft.title.trim();
    if (!title) return;
    saveAccount({
      ...accountDraft,
      id: accountDraft.id || `a_${crypto.randomUUID()}`,
      title,
      openingBalanceToman: Number(accountDraft.openingBalanceToman) || 0,
    });
    resetAccount();
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

      {tab === "categories" ? (
        <>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-extrabold text-ink">{categoryDraft.id ? "ویرایش دسته‌بندی" : "دسته‌بندی جدید"}</div>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={categoryDraft.icon ?? ""}
                  onChange={(e) => setCategoryDraft((draft) => ({ ...draft, icon: e.target.value }))}
                  placeholder="آیکن"
                  className="rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
                />
                <input
                  value={categoryDraft.title}
                  onChange={(e) => setCategoryDraft((draft) => ({ ...draft, title: e.target.value }))}
                  placeholder="نام دسته"
                  className="col-span-2 rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-bg p-1 text-xs">
                <Chip active={categoryDraft.type === "expense"} onClick={() => setCategoryDraft((draft) => ({ ...draft, type: "expense" }))}>
                  هزینه
                </Chip>
                <Chip active={categoryDraft.type === "income"} onClick={() => setCategoryDraft((draft) => ({ ...draft, type: "income" }))}>
                  درآمد
                </Chip>
                <button
                  onClick={() => setCategoryDraft((draft) => ({ ...draft, popular: !draft.popular }))}
                  className={`rounded-xl px-2 py-2 font-bold ${categoryDraft.popular ? "bg-orange-soft text-orange" : "text-ink hover:bg-white"}`}
                >
                  پرکاربرد
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={submitCategory} className="rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
                  ذخیره
                </button>
                <button onClick={resetCategory} className="rounded-2xl bg-bg px-4 py-3 text-sm font-extrabold text-muted">
                  پاک کردن فرم
                </button>
              </div>
            </div>
          </div>

          <Section title="هزینه‌ها">
            {categories.filter((c) => c.type === "expense").map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => setCategoryDraft(category)}
                onDelete={() => deleteCategory(category.id)}
              />
            ))}
          </Section>

          <Section title="درآمدها">
            {categories.filter((c) => c.type === "income").map((category) => (
              <CategoryRow
                key={category.id}
                category={category}
                onEdit={() => setCategoryDraft(category)}
                onDelete={() => deleteCategory(category.id)}
              />
            ))}
          </Section>
        </>
      ) : (
        <>
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-sm font-extrabold text-ink">{accountDraft.id ? "ویرایش حساب" : "حساب جدید"}</div>
            <div className="mt-3 space-y-3">
              <input
                value={accountDraft.title}
                onChange={(e) => setAccountDraft((draft) => ({ ...draft, title: e.target.value }))}
                placeholder="نام حساب"
                className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
              />
              <input
                value={accountDraft.openingBalanceToman ?? 0}
                onChange={(e) => setAccountDraft((draft) => ({ ...draft, openingBalanceToman: Number(e.target.value) || 0 }))}
                inputMode="numeric"
                placeholder="موجودی اولیه"
                className="w-full rounded-2xl bg-bg px-3 py-3 text-sm ring-1 ring-black/5 outline-none focus:ring-navy-900/20"
              />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={submitAccount} className="rounded-2xl bg-navy-900 px-4 py-3 text-sm font-extrabold text-white">
                  ذخیره
                </button>
                <button onClick={resetAccount} className="rounded-2xl bg-bg px-4 py-3 text-sm font-extrabold text-muted">
                  پاک کردن فرم
                </button>
              </div>
            </div>
          </div>

          <Section title="حساب‌ها">
            {accounts.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                onEdit={() => setAccountDraft(account)}
                onDelete={() => deleteAccount(account.id)}
              />
            ))}
          </Section>
        </>
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

function CategoryRow({ category, onEdit, onDelete }: { category: Category; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-bg px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-ink">
          {category.icon ? `${category.icon} ` : ""}
          {category.title}
        </div>
        <div className="text-[11px] text-muted">{category.popular ? "پرکاربرد" : "معمولی"}</div>
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

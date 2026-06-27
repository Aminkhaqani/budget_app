import { createClient } from "@supabase/supabase-js";
import type { Account, Category, Tx } from "../layout/Appshell";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://pgerefjmnybgsnbphrnh.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable__cL2BFSQediduWrazgzRYQ_b6YP9D8r";

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

type CategoryRow = {
  id: string;
  type: "income" | "expense";
  title: string;
  icon: string | null;
  popular: boolean;
};

type AccountRow = {
  id: string;
  title: string;
  opening_balance_toman: number;
};

type TxRow = {
  id: string;
  type: "income" | "expense" | "transfer";
  amount_toman: number;
  date: string;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  note: string | null;
};

function warnRemote(error: unknown) {
  console.warn("Budget remote sync failed", error);
}

const toCategoryRow = (category: Category): CategoryRow => ({
  id: category.id,
  type: category.type,
  title: category.title,
  icon: category.icon ?? null,
  popular: category.popular ?? false,
});

const fromCategoryRow = (row: CategoryRow): Category => ({
  id: row.id,
  type: row.type,
  title: row.title,
  icon: row.icon ?? undefined,
  popular: row.popular,
});

const toAccountRow = (account: Account): AccountRow => ({
  id: account.id,
  title: account.title,
  opening_balance_toman: account.openingBalanceToman ?? 0,
});

const fromAccountRow = (row: AccountRow): Account => ({
  id: row.id,
  title: row.title,
  openingBalanceToman: row.opening_balance_toman,
});

const toTxRow = (tx: Tx): TxRow => ({
  id: tx.id,
  type: tx.type,
  amount_toman: tx.amountToman,
  date: tx.date,
  category_id: tx.categoryId ?? null,
  from_account_id: tx.fromAccountId ?? null,
  to_account_id: tx.toAccountId ?? null,
  note: tx.note ?? null,
});

const fromTxRow = (row: TxRow): Tx => ({
  id: row.id,
  type: row.type,
  amountToman: row.amount_toman,
  date: row.date,
  categoryId: row.category_id ?? undefined,
  fromAccountId: row.from_account_id ?? undefined,
  toAccountId: row.to_account_id ?? undefined,
  note: row.note ?? undefined,
});

export async function syncBudgetData(local: { txs: Tx[]; categories: Category[]; accounts: Account[] }) {
  if (!supabase) return null;

  try {
    if (local.categories.length) {
      const { error } = await supabase.from("categories").upsert(local.categories.map(toCategoryRow));
      if (error) throw error;
    }

    if (local.accounts.length) {
      const { error } = await supabase.from("accounts").upsert(local.accounts.map(toAccountRow));
      if (error) throw error;
    }

    if (local.txs.length) {
      const { error } = await supabase.from("transactions").upsert(local.txs.map(toTxRow));
      if (error) throw error;
    }

    const [categoriesResult, accountsResult, txsResult] = await Promise.all([
      supabase.from("categories").select("id,type,title,icon,popular").order("type").order("title"),
      supabase.from("accounts").select("id,title,opening_balance_toman").order("title"),
      supabase.from("transactions").select("id,type,amount_toman,date,category_id,from_account_id,to_account_id,note").order("date", { ascending: false }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (accountsResult.error) throw accountsResult.error;
    if (txsResult.error) throw txsResult.error;

    return {
      categories: (categoriesResult.data ?? []).map((row) => fromCategoryRow(row as CategoryRow)),
      accounts: (accountsResult.data ?? []).map((row) => fromAccountRow(row as AccountRow)),
      txs: (txsResult.data ?? []).map((row) => fromTxRow(row as TxRow)),
    };
  } catch (error) {
    warnRemote(error);
    return null;
  }
}

export async function saveRemoteTx(tx: Tx) {
  if (!supabase) return;
  const { error } = await supabase.from("transactions").upsert(toTxRow(tx));
  if (error) warnRemote(error);
}

export async function deleteRemoteTx(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) warnRemote(error);
}

export async function saveRemoteCategory(category: Category) {
  if (!supabase) return;
  const { error } = await supabase.from("categories").upsert(toCategoryRow(category));
  if (error) warnRemote(error);
}

export async function deleteRemoteCategory(id: string, targetCategoryId?: string) {
  if (!supabase) return;
  const update = await supabase.from("transactions").update({ category_id: targetCategoryId ?? null }).eq("category_id", id);
  if (update.error) warnRemote(update.error);
  const deleted = await supabase.from("categories").delete().eq("id", id);
  if (deleted.error) warnRemote(deleted.error);
}

export async function saveRemoteAccount(account: Account) {
  if (!supabase) return;
  const { error } = await supabase.from("accounts").upsert(toAccountRow(account));
  if (error) warnRemote(error);
}

export async function deleteRemoteAccount(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) warnRemote(error);
}

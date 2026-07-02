import { createClient } from "@supabase/supabase-js";
import type { Account, Category, PlannedItem, Tx } from "../layout/Appshell";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://pgerefjmnybgsnbphrnh.supabase.co";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable__cL2BFSQediduWrazgzRYQ_b6YP9D8r";

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const OFFLINE_QUEUE_KEY = "budget-app:sync-queue:v1";

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
  created_at?: string;
  category_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  note: string | null;
};

type PlannedItemRow = {
  id: string;
  title: string;
  type: "income" | "must" | "flex";
  amount_toman: number;
  day_of_month: number;
  active: boolean;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
};

type RemoteOperation =
  | { id: string; type: "saveTx"; tx: Tx }
  | { id: string; type: "deleteTx"; txId: string }
  | { id: string; type: "saveCategory"; category: Category }
  | { id: string; type: "deleteCategory"; categoryId: string; targetCategoryId?: string }
  | { id: string; type: "saveAccount"; account: Account }
  | { id: string; type: "deleteAccount"; accountId: string }
  | { id: string; type: "savePlannedItem"; plannedItem: PlannedItem }
  | { id: string; type: "deletePlannedItem"; plannedItemId: string };

type QueuedOperation =
  | { type: "saveTx"; tx: Tx }
  | { type: "deleteTx"; txId: string }
  | { type: "saveCategory"; category: Category }
  | { type: "deleteCategory"; categoryId: string; targetCategoryId?: string }
  | { type: "saveAccount"; account: Account }
  | { type: "deleteAccount"; accountId: string }
  | { type: "savePlannedItem"; plannedItem: PlannedItem }
  | { type: "deletePlannedItem"; plannedItemId: string };

function warnRemote(error: unknown) {
  console.warn("Budget remote sync failed", error);
}

function queueId() {
  return `${Date.now()}_${crypto.randomUUID()}`;
}

function loadQueue(): RemoteOperation[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RemoteOperation[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: RemoteOperation[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(operation: QueuedOperation) {
  saveQueue([...loadQueue(), { ...operation, id: queueId() } as RemoteOperation]);
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
  created_at: tx.createdAt,
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
  createdAt: row.created_at,
  categoryId: row.category_id ?? undefined,
  fromAccountId: row.from_account_id ?? undefined,
  toAccountId: row.to_account_id ?? undefined,
  note: row.note ?? undefined,
});

const toPlannedItemRow = (plannedItem: PlannedItem): PlannedItemRow => ({
  id: plannedItem.id,
  title: plannedItem.title,
  type: plannedItem.type,
  amount_toman: plannedItem.amountToman,
  day_of_month: plannedItem.dayOfMonth,
  active: plannedItem.active,
  category_id: plannedItem.categoryId ?? null,
  account_id: plannedItem.accountId ?? null,
  note: plannedItem.note ?? null,
});

const fromPlannedItemRow = (row: PlannedItemRow): PlannedItem => ({
  id: row.id,
  title: row.title,
  type: row.type,
  amountToman: row.amount_toman,
  dayOfMonth: row.day_of_month,
  active: row.active,
  categoryId: row.category_id ?? undefined,
  accountId: row.account_id ?? undefined,
  note: row.note ?? undefined,
});

async function runOperation(operation: RemoteOperation) {
  if (!supabase) throw new Error("Supabase is not configured");

  if (operation.type === "saveTx") {
    const { error } = await supabase.from("transactions").upsert(toTxRow(operation.tx));
    if (error) throw error;
  }

  if (operation.type === "deleteTx") {
    const { error } = await supabase.from("transactions").delete().eq("id", operation.txId);
    if (error) throw error;
  }

  if (operation.type === "saveCategory") {
    const { error } = await supabase.from("categories").upsert(toCategoryRow(operation.category));
    if (error) throw error;
  }

  if (operation.type === "deleteCategory") {
    const update = await supabase
      .from("transactions")
      .update({ category_id: operation.targetCategoryId ?? null })
      .eq("category_id", operation.categoryId);
    if (update.error) throw update.error;
    const deleted = await supabase.from("categories").delete().eq("id", operation.categoryId);
    if (deleted.error) throw deleted.error;
  }

  if (operation.type === "saveAccount") {
    const { error } = await supabase.from("accounts").upsert(toAccountRow(operation.account));
    if (error) throw error;
  }

  if (operation.type === "deleteAccount") {
    const { error } = await supabase.from("accounts").delete().eq("id", operation.accountId);
    if (error) throw error;
  }

  if (operation.type === "savePlannedItem") {
    const { error } = await supabase.from("planned_items").upsert(toPlannedItemRow(operation.plannedItem));
    if (error) throw error;
  }

  if (operation.type === "deletePlannedItem") {
    const { error } = await supabase.from("planned_items").delete().eq("id", operation.plannedItemId);
    if (error) throw error;
  }
}

export async function flushQueuedBudgetOperations() {
  const queue = loadQueue();
  if (!queue.length) return true;

  const remaining: RemoteOperation[] = [];
  for (const operation of queue) {
    try {
      await runOperation(operation);
    } catch (error) {
      warnRemote(error);
      remaining.push(operation);
    }
  }

  saveQueue(remaining);
  return remaining.length === 0;
}

export async function syncBudgetData() {
  if (!supabase) return null;

  try {
    await flushQueuedBudgetOperations();

    const [categoriesResult, accountsResult, txsResult, plannedItemsResult] = await Promise.all([
      supabase.from("categories").select("id,type,title,icon,popular").order("type").order("title"),
      supabase.from("accounts").select("id,title,opening_balance_toman").order("title"),
      supabase
        .from("transactions")
        .select("id,type,amount_toman,date,created_at,category_id,from_account_id,to_account_id,note")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("planned_items")
        .select("id,title,type,amount_toman,day_of_month,active,category_id,account_id,note")
        .order("type")
        .order("day_of_month"),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (accountsResult.error) throw accountsResult.error;
    if (txsResult.error) throw txsResult.error;
    if (plannedItemsResult.error) throw plannedItemsResult.error;

    return {
      categories: (categoriesResult.data ?? []).map((row) => fromCategoryRow(row as CategoryRow)),
      accounts: (accountsResult.data ?? []).map((row) => fromAccountRow(row as AccountRow)),
      txs: (txsResult.data ?? []).map((row) => fromTxRow(row as TxRow)),
      plannedItems: (plannedItemsResult.data ?? []).map((row) => fromPlannedItemRow(row as PlannedItemRow)),
    };
  } catch (error) {
    warnRemote(error);
    return null;
  }
}

export function subscribeBudgetChanges(onChange: () => void) {
  if (!supabase) return () => undefined;

  const channel = supabase
    .channel(`budget-data-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "planned_items" }, onChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") warnRemote(`Realtime ${status}`);
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function saveRemoteTx(tx: Tx) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "saveTx", tx });
  } catch (error) {
    enqueue({ type: "saveTx", tx });
    warnRemote(error);
  }
}

export async function deleteRemoteTx(id: string) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "deleteTx", txId: id });
  } catch (error) {
    enqueue({ type: "deleteTx", txId: id });
    warnRemote(error);
  }
}

export async function saveRemoteCategory(category: Category) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "saveCategory", category });
  } catch (error) {
    enqueue({ type: "saveCategory", category });
    warnRemote(error);
  }
}

export async function deleteRemoteCategory(id: string, targetCategoryId?: string) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "deleteCategory", categoryId: id, targetCategoryId });
  } catch (error) {
    enqueue({ type: "deleteCategory", categoryId: id, targetCategoryId });
    warnRemote(error);
  }
}

export async function saveRemoteAccount(account: Account) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "saveAccount", account });
  } catch (error) {
    enqueue({ type: "saveAccount", account });
    warnRemote(error);
  }
}

export async function deleteRemoteAccount(id: string) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "deleteAccount", accountId: id });
  } catch (error) {
    enqueue({ type: "deleteAccount", accountId: id });
    warnRemote(error);
  }
}

export async function saveRemotePlannedItem(plannedItem: PlannedItem) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "savePlannedItem", plannedItem });
  } catch (error) {
    enqueue({ type: "savePlannedItem", plannedItem });
    warnRemote(error);
  }
}

export async function deleteRemotePlannedItem(id: string) {
  if (!supabase) return;
  try {
    await runOperation({ id: queueId(), type: "deletePlannedItem", plannedItemId: id });
  } catch (error) {
    enqueue({ type: "deletePlannedItem", plannedItemId: id });
    warnRemote(error);
  }
}

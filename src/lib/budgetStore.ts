import { createClient } from "@supabase/supabase-js";
import type { Account, Category, Loan, LoanInstallment, PlannedItem, Tx } from "../layout/Appshell";

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

type LoanRow = {
  id: string;
  title: string;
  lender: string | null;
  principal_toman: number;
  received_date: string;
  active: boolean;
  note: string | null;
};

type LoanInstallmentRow = {
  id: string;
  loan_id: string;
  due_date: string;
  amount_toman: number;
  paid: boolean;
  paid_amount_toman: number | null;
  paid_date: string | null;
  transaction_id: string | null;
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
  | { id: string; type: "deletePlannedItem"; plannedItemId: string }
  | { id: string; type: "saveLoan"; loan: Loan }
  | { id: string; type: "deleteLoan"; loanId: string }
  | { id: string; type: "saveLoanInstallment"; loanInstallment: LoanInstallment }
  | { id: string; type: "deleteLoanInstallment"; loanInstallmentId: string };

type QueuedOperation =
  | { type: "saveTx"; tx: Tx }
  | { type: "deleteTx"; txId: string }
  | { type: "saveCategory"; category: Category }
  | { type: "deleteCategory"; categoryId: string; targetCategoryId?: string }
  | { type: "saveAccount"; account: Account }
  | { type: "deleteAccount"; accountId: string }
  | { type: "savePlannedItem"; plannedItem: PlannedItem }
  | { type: "deletePlannedItem"; plannedItemId: string }
  | { type: "saveLoan"; loan: Loan }
  | { type: "deleteLoan"; loanId: string }
  | { type: "saveLoanInstallment"; loanInstallment: LoanInstallment }
  | { type: "deleteLoanInstallment"; loanInstallmentId: string };

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

async function enqueueAndFlush(operation: QueuedOperation) {
  enqueue(operation);
  if (!supabase) return;
  await flushQueuedBudgetOperations();
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

const toLoanRow = (loan: Loan): LoanRow => ({
  id: loan.id,
  title: loan.title,
  lender: loan.lender ?? null,
  principal_toman: loan.principalToman,
  received_date: loan.receivedDate,
  active: loan.active,
  note: loan.note ?? null,
});

const fromLoanRow = (row: LoanRow): Loan => ({
  id: row.id,
  title: row.title,
  lender: row.lender ?? undefined,
  principalToman: row.principal_toman,
  receivedDate: row.received_date,
  active: row.active,
  note: row.note ?? undefined,
});

const toLoanInstallmentRow = (loanInstallment: LoanInstallment): LoanInstallmentRow => ({
  id: loanInstallment.id,
  loan_id: loanInstallment.loanId,
  due_date: loanInstallment.dueDate,
  amount_toman: loanInstallment.amountToman,
  paid: loanInstallment.paid,
  paid_amount_toman: loanInstallment.paidAmountToman ?? null,
  paid_date: loanInstallment.paidDate ?? null,
  transaction_id: loanInstallment.transactionId ?? null,
  note: loanInstallment.note ?? null,
});

const fromLoanInstallmentRow = (row: LoanInstallmentRow): LoanInstallment => ({
  id: row.id,
  loanId: row.loan_id,
  dueDate: row.due_date,
  amountToman: row.amount_toman,
  paid: row.paid,
  paidAmountToman: row.paid_amount_toman ?? undefined,
  paidDate: row.paid_date ?? undefined,
  transactionId: row.transaction_id ?? undefined,
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

  if (operation.type === "saveLoan") {
    const { error } = await supabase.from("loans").upsert(toLoanRow(operation.loan));
    if (error) throw error;
  }

  if (operation.type === "deleteLoan") {
    const { error } = await supabase.from("loans").delete().eq("id", operation.loanId);
    if (error) throw error;
  }

  if (operation.type === "saveLoanInstallment") {
    const { error } = await supabase.from("loan_installments").upsert(toLoanInstallmentRow(operation.loanInstallment));
    if (error) throw error;
  }

  if (operation.type === "deleteLoanInstallment") {
    const { error } = await supabase.from("loan_installments").delete().eq("id", operation.loanInstallmentId);
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
    const queueFlushed = await flushQueuedBudgetOperations();
    if (!queueFlushed) return null;

    const [categoriesResult, accountsResult, txsResult, plannedItemsResult, loansResult, loanInstallmentsResult] = await Promise.all([
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
      supabase
        .from("loans")
        .select("id,title,lender,principal_toman,received_date,active,note")
        .order("received_date", { ascending: false }),
      supabase
        .from("loan_installments")
        .select("id,loan_id,due_date,amount_toman,paid,paid_amount_toman,paid_date,transaction_id,note")
        .order("due_date"),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (accountsResult.error) throw accountsResult.error;
    if (txsResult.error) throw txsResult.error;
    if (plannedItemsResult.error) throw plannedItemsResult.error;
    if (loansResult.error) throw loansResult.error;
    if (loanInstallmentsResult.error) throw loanInstallmentsResult.error;

    return {
      categories: (categoriesResult.data ?? []).map((row) => fromCategoryRow(row as CategoryRow)),
      accounts: (accountsResult.data ?? []).map((row) => fromAccountRow(row as AccountRow)),
      txs: (txsResult.data ?? []).map((row) => fromTxRow(row as TxRow)),
      plannedItems: (plannedItemsResult.data ?? []).map((row) => fromPlannedItemRow(row as PlannedItemRow)),
      loans: (loansResult.data ?? []).map((row) => fromLoanRow(row as LoanRow)),
      loanInstallments: (loanInstallmentsResult.data ?? []).map((row) => fromLoanInstallmentRow(row as LoanInstallmentRow)),
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
    .on("postgres_changes", { event: "*", schema: "public", table: "loans" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "loan_installments" }, onChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") warnRemote(`Realtime ${status}`);
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function saveRemoteTx(tx: Tx) {
  await enqueueAndFlush({ type: "saveTx", tx });
}

export async function deleteRemoteTx(id: string) {
  await enqueueAndFlush({ type: "deleteTx", txId: id });
}

export async function saveRemoteCategory(category: Category) {
  await enqueueAndFlush({ type: "saveCategory", category });
}

export async function deleteRemoteCategory(id: string, targetCategoryId?: string) {
  await enqueueAndFlush({ type: "deleteCategory", categoryId: id, targetCategoryId });
}

export async function saveRemoteAccount(account: Account) {
  await enqueueAndFlush({ type: "saveAccount", account });
}

export async function deleteRemoteAccount(id: string) {
  await enqueueAndFlush({ type: "deleteAccount", accountId: id });
}

export async function saveRemotePlannedItem(plannedItem: PlannedItem) {
  await enqueueAndFlush({ type: "savePlannedItem", plannedItem });
}

export async function deleteRemotePlannedItem(id: string) {
  await enqueueAndFlush({ type: "deletePlannedItem", plannedItemId: id });
}

export async function saveRemoteLoan(loan: Loan) {
  await enqueueAndFlush({ type: "saveLoan", loan });
}

export async function deleteRemoteLoan(id: string) {
  await enqueueAndFlush({ type: "deleteLoan", loanId: id });
}

export async function saveRemoteLoanInstallment(loanInstallment: LoanInstallment) {
  await enqueueAndFlush({ type: "saveLoanInstallment", loanInstallment });
}

export async function deleteRemoteLoanInstallment(id: string) {
  await enqueueAndFlush({ type: "deleteLoanInstallment", loanInstallmentId: id });
}

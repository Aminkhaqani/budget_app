import type { Account, Tx } from "../layout/Appshell";

export function accountBalance(account: Account, txs: Tx[], untilDate?: string) {
  const opening = account.openingBalanceToman ?? 0;
  return txs.reduce((sum, tx) => {
    if (untilDate && tx.date > untilDate) return sum;
    if (tx.type === "income" && tx.toAccountId === account.id) return sum + tx.amountToman;
    if (tx.type === "expense" && tx.fromAccountId === account.id) return sum - tx.amountToman;
    if (tx.type === "transfer" && tx.toAccountId === account.id) return sum + tx.amountToman;
    if (tx.type === "transfer" && tx.fromAccountId === account.id) return sum - tx.amountToman;
    return sum;
  }, opening);
}

export function totalCashBalance(accounts: Account[], txs: Tx[], untilDate?: string) {
  return accounts
    .filter((account) => (account.kind ?? "cash") === "cash")
    .reduce((sum, account) => sum + accountBalance(account, txs, untilDate), 0);
}

export function defaultExpenseAccount(accounts: Account[]) {
  return accounts.find((account) => account.defaultForExpense) ?? accounts.find((account) => (account.kind ?? "cash") === "cash") ?? accounts[0];
}

export function defaultIncomeAccount(accounts: Account[]) {
  return (
    accounts.find((account) => account.defaultForIncome) ??
    accounts.find((account) => account.defaultForExpense) ??
    accounts.find((account) => (account.kind ?? "cash") === "cash") ??
    accounts[0]
  );
}

export function accountMovementLabel(tx: Tx, accounts: Account[]) {
  const from = tx.fromAccountId ? accounts.find((account) => account.id === tx.fromAccountId) : undefined;
  const to = tx.toAccountId ? accounts.find((account) => account.id === tx.toAccountId) : undefined;

  if (tx.type === "expense") return from?.title ? `از ${from.title}` : "بدون حساب مبدا";
  if (tx.type === "income") return to?.title ? `به ${to.title}` : "بدون حساب مقصد";
  if (from?.title && to?.title) return `${from.title} ← ${to.title}`;
  return "جابجایی بدون حساب کامل";
}

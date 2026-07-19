alter table public.accounts
  alter column opening_balance_toman type bigint
  using opening_balance_toman::bigint;

alter table public.transactions
  alter column amount_toman type bigint
  using amount_toman::bigint;

create table if not exists public.loans (
  id text primary key,
  title text not null,
  lender text,
  principal_toman bigint not null check (principal_toman >= 0),
  received_date date not null,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_installments (
  id text primary key,
  loan_id text not null references public.loans(id) on delete cascade,
  due_date date not null,
  amount_toman bigint not null check (amount_toman >= 0),
  paid boolean not null default false,
  paid_amount_toman bigint,
  paid_date date,
  transaction_id text references public.transactions(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (paid_amount_toman is null or paid_amount_toman >= 0)
);

create index if not exists loan_installments_loan_id_idx on public.loan_installments(loan_id);
create index if not exists loan_installments_due_date_idx on public.loan_installments(due_date);
create index if not exists loans_active_idx on public.loans(active);

grant all on table public.loans to anon, authenticated;
grant all on table public.loan_installments to anon, authenticated;

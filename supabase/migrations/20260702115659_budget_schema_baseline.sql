create table if not exists public.categories (
  id text primary key,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  icon text,
  popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id text primary key,
  title text not null,
  opening_balance_toman bigint not null default 0 check (opening_balance_toman >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount_toman bigint not null check (amount_toman >= 0),
  date date not null,
  created_at timestamptz not null default now(),
  category_id text references public.categories(id) on delete set null,
  from_account_id text references public.accounts(id) on delete set null,
  to_account_id text references public.accounts(id) on delete set null,
  note text
);

create table if not exists public.planned_items (
  id text primary key,
  title text not null,
  type text not null check (type in ('income', 'must', 'flex')),
  amount_toman bigint not null check (amount_toman >= 0),
  day_of_month integer not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  category_id text references public.categories(id) on delete set null,
  account_id text references public.accounts(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_type_title_idx on public.categories(type, title);
create index if not exists accounts_title_idx on public.accounts(title);
create index if not exists transactions_date_created_at_idx on public.transactions(date desc, created_at desc);
create index if not exists transactions_category_id_idx on public.transactions(category_id);
create index if not exists transactions_from_account_id_idx on public.transactions(from_account_id);
create index if not exists transactions_to_account_id_idx on public.transactions(to_account_id);
create index if not exists planned_items_type_day_idx on public.planned_items(type, day_of_month);

grant all on table public.categories to anon, authenticated;
grant all on table public.accounts to anon, authenticated;
grant all on table public.transactions to anon, authenticated;
grant all on table public.planned_items to anon, authenticated;

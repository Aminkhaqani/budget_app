alter table public.accounts add column if not exists bank_key text;
alter table public.accounts add column if not exists color text;
alter table public.accounts add column if not exists default_for_expense boolean not null default false;
alter table public.accounts add column if not exists default_for_income boolean not null default false;

create index if not exists accounts_owner_default_expense_idx
  on public.accounts(owner_id)
  where default_for_expense;

create index if not exists accounts_owner_default_income_idx
  on public.accounts(owner_id)
  where default_for_income;

do $$
declare
  owner uuid := 'b0d75905-0912-4000-9000-000000000001'::uuid;
begin
  insert into public.accounts (id, title, opening_balance_toman, bank_key, color, default_for_expense, default_for_income, owner_id)
  values
    ('a_pasargad', U&'\067E\0627\0633\0627\0631\06AF\0627\062F', 0, 'pasargad', '#0b1b3a', true, false, owner),
    ('a_blu', U&'\0628\0644\0648\0628\0627\0646\06A9', 0, 'blu', '#16a3ff', false, false, owner),
    ('a_saman', U&'\0633\0627\0645\0627\0646', 0, 'saman', '#0a55a0', false, false, owner),
    ('a_melli', U&'\0645\0644\06CC', 0, 'melli', '#d71920', false, false, owner)
  on conflict (id) do update
  set
    title = excluded.title,
    bank_key = excluded.bank_key,
    color = excluded.color;

  update public.accounts
  set default_for_expense = false
  where owner_id = owner and id <> 'a_pasargad' and default_for_expense = true;
end $$;

do $$
declare
  owner uuid := 'b0d75905-0912-4000-9000-000000000001'::uuid;
begin
  alter table public.categories add column if not exists owner_id uuid references auth.users(id) on delete restrict;
  alter table public.accounts add column if not exists owner_id uuid references auth.users(id) on delete restrict;
  alter table public.transactions add column if not exists owner_id uuid references auth.users(id) on delete restrict;
  alter table public.planned_items add column if not exists owner_id uuid references auth.users(id) on delete restrict;
  alter table public.loans add column if not exists owner_id uuid references auth.users(id) on delete restrict;
  alter table public.loan_installments add column if not exists owner_id uuid references auth.users(id) on delete restrict;

  update public.categories set owner_id = owner where owner_id is null;
  update public.accounts set owner_id = owner where owner_id is null;
  update public.transactions set owner_id = owner where owner_id is null;
  update public.planned_items set owner_id = owner where owner_id is null;
  update public.loans set owner_id = owner where owner_id is null;
  update public.loan_installments set owner_id = owner where owner_id is null;

  alter table public.categories alter column owner_id set not null;
  alter table public.accounts alter column owner_id set not null;
  alter table public.transactions alter column owner_id set not null;
  alter table public.planned_items alter column owner_id set not null;
  alter table public.loans alter column owner_id set not null;
  alter table public.loan_installments alter column owner_id set not null;
end $$;

create or replace function public.set_budget_owner_id()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null then
    new.owner_id := (select auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists set_categories_owner_id on public.categories;
create trigger set_categories_owner_id
before insert on public.categories
for each row execute function public.set_budget_owner_id();

drop trigger if exists set_accounts_owner_id on public.accounts;
create trigger set_accounts_owner_id
before insert on public.accounts
for each row execute function public.set_budget_owner_id();

drop trigger if exists set_transactions_owner_id on public.transactions;
create trigger set_transactions_owner_id
before insert on public.transactions
for each row execute function public.set_budget_owner_id();

drop trigger if exists set_planned_items_owner_id on public.planned_items;
create trigger set_planned_items_owner_id
before insert on public.planned_items
for each row execute function public.set_budget_owner_id();

drop trigger if exists set_loans_owner_id on public.loans;
create trigger set_loans_owner_id
before insert on public.loans
for each row execute function public.set_budget_owner_id();

drop trigger if exists set_loan_installments_owner_id on public.loan_installments;
create trigger set_loan_installments_owner_id
before insert on public.loan_installments
for each row execute function public.set_budget_owner_id();

create index if not exists categories_owner_id_idx on public.categories(owner_id);
create index if not exists accounts_owner_id_idx on public.accounts(owner_id);
create index if not exists transactions_owner_id_date_idx on public.transactions(owner_id, date desc, created_at desc);
create index if not exists planned_items_owner_id_idx on public.planned_items(owner_id);
create index if not exists loans_owner_id_idx on public.loans(owner_id);
create index if not exists loan_installments_owner_id_due_date_idx on public.loan_installments(owner_id, due_date);

revoke all on table public.categories from anon;
revoke all on table public.accounts from anon;
revoke all on table public.transactions from anon;
revoke all on table public.planned_items from anon;
revoke all on table public.loans from anon;
revoke all on table public.loan_installments from anon;

grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.accounts to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.planned_items to authenticated;
grant select, insert, update, delete on table public.loans to authenticated;
grant select, insert, update, delete on table public.loan_installments to authenticated;

alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.planned_items enable row level security;
alter table public.loans enable row level security;
alter table public.loan_installments enable row level security;

drop policy if exists "budget owner access" on public.categories;
create policy "budget owner access" on public.categories
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "budget owner access" on public.accounts;
create policy "budget owner access" on public.accounts
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "budget owner access" on public.transactions;
create policy "budget owner access" on public.transactions
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "budget owner access" on public.planned_items;
create policy "budget owner access" on public.planned_items
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "budget owner access" on public.loans;
create policy "budget owner access" on public.loans
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "budget owner access" on public.loan_installments;
create policy "budget owner access" on public.loan_installments
for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

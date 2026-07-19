alter table public.accounts add column if not exists account_kind text not null default 'cash';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_account_kind_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_account_kind_check
      check (account_kind in ('cash', 'investment', 'debt', 'receivable'));
  end if;
end $$;

update public.accounts
set account_kind = 'cash'
where account_kind is null;

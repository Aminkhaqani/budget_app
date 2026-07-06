create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  display_name text,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  subject text not null,
  category text not null check (category in ('bug', 'improvement', 'error', 'question', 'other')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  body text not null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_budget_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) = 'b0d75905-0912-4000-9000-000000000001'::uuid;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_user_profiles_updated_at on public.user_profiles;
create trigger touch_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_support_tickets_updated_at on public.support_tickets;
create trigger touch_support_tickets_updated_at
before update on public.support_tickets
for each row execute function public.touch_updated_at();

insert into public.user_profiles (id, email, phone, display_name, role, status)
values (
  'b0d75905-0912-4000-9000-000000000001'::uuid,
  'amin.khaghani.budget@gmail.com',
  '09120075905',
  'Amin Khaghani',
  'admin',
  'active'
)
on conflict (id) do update set
  email = excluded.email,
  phone = excluded.phone,
  display_name = excluded.display_name,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists support_tickets_customer_id_created_at_idx on public.support_tickets(customer_id, created_at desc);
create index if not exists support_tickets_status_created_at_idx on public.support_tickets(status, created_at desc);

revoke all on table public.user_profiles from anon;
revoke all on table public.support_tickets from anon;

grant select, insert, update on table public.user_profiles to authenticated;
grant select, insert, update on table public.support_tickets to authenticated;

alter table public.user_profiles enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "profiles are visible to owner and admin" on public.user_profiles;
create policy "profiles are visible to owner and admin" on public.user_profiles
for select to authenticated
using ((select auth.uid()) = id or public.is_budget_admin());

drop policy if exists "customers can create own profile" on public.user_profiles;
create policy "customers can create own profile" on public.user_profiles
for insert to authenticated
with check ((select auth.uid()) = id and role = 'customer');

drop policy if exists "customers can update own profile" on public.user_profiles;
create policy "customers can update own profile" on public.user_profiles
for update to authenticated
using ((select auth.uid()) = id or public.is_budget_admin())
with check (
  public.is_budget_admin()
  or ((select auth.uid()) = id and role = 'customer')
);

drop policy if exists "tickets are visible to owner and admin" on public.support_tickets;
create policy "tickets are visible to owner and admin" on public.support_tickets
for select to authenticated
using ((select auth.uid()) = customer_id or public.is_budget_admin());

drop policy if exists "customers can create own tickets" on public.support_tickets;
create policy "customers can create own tickets" on public.support_tickets
for insert to authenticated
with check ((select auth.uid()) = customer_id);

drop policy if exists "owners and admin can update tickets" on public.support_tickets;
create policy "owners and admin can update tickets" on public.support_tickets
for update to authenticated
using ((select auth.uid()) = customer_id or public.is_budget_admin())
with check ((select auth.uid()) = customer_id or public.is_budget_admin());

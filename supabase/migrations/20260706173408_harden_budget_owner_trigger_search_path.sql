create or replace function public.set_budget_owner_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is null then
    new.owner_id := (select auth.uid());
  end if;

  return new;
end;
$$;

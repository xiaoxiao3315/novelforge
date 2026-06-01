create table public.credit_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  balance integer not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_accounts_balance_check check (balance >= 0)
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid,
  generation_log_id uuid,
  operation text not null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  status text not null,
  created_at timestamptz not null default now(),
  constraint credit_transactions_status_check check (status in ('succeeded', 'failed')),
  constraint credit_transactions_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  constraint credit_transactions_generation_log_fk
    foreign key (generation_log_id)
    references public.generation_logs(id)
    on delete set null
);

create index credit_transactions_user_id_created_at_idx
  on public.credit_transactions(user_id, created_at desc);
create index credit_transactions_project_id_created_at_idx
  on public.credit_transactions(project_id, created_at desc);
create index credit_transactions_generation_log_id_idx
  on public.credit_transactions(generation_log_id);

create trigger credit_accounts_set_updated_at
before update on public.credit_accounts
for each row execute function public.set_updated_at();

alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;

create policy "credit_accounts select own"
on public.credit_accounts
for select
to authenticated
using (user_id = auth.uid());

create policy "credit_transactions select own"
on public.credit_transactions
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.get_or_create_credit_balance()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance integer;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.credit_accounts(user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select balance
  into v_balance
  from public.credit_accounts
  where user_id = v_user_id;

  if v_balance is null then
    raise exception 'credit account initialization failed';
  end if;

  return v_balance;
end;
$$;

create or replace function public.spend_generation_credits(
  p_project_id uuid,
  p_generation_log_id uuid,
  p_operation text,
  p_amount integer,
  p_reason text
)
returns table(transaction_id uuid, balance_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance_after integer;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_amount <= 0 then
    raise exception 'credit amount must be positive';
  end if;

  if p_generation_log_id is not null and not exists (
    select 1
    from public.generation_logs
    where id = p_generation_log_id
      and user_id = v_user_id
  ) then
    raise exception 'generation log does not belong to current user';
  end if;

  insert into public.credit_accounts(user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  update public.credit_accounts
  set balance = balance - p_amount
  where user_id = v_user_id
    and balance >= p_amount
  returning balance into v_balance_after;

  if v_balance_after is null then
    raise exception 'insufficient credits';
  end if;

  insert into public.credit_transactions(
    user_id,
    project_id,
    generation_log_id,
    operation,
    amount,
    balance_after,
    reason,
    status
  )
  values (
    v_user_id,
    p_project_id,
    p_generation_log_id,
    p_operation,
    -p_amount,
    v_balance_after,
    p_reason,
    'succeeded'
  )
  returning id into v_transaction_id;

  return query select v_transaction_id, v_balance_after;
end;
$$;

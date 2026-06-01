create table public.credit_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  order_no text not null unique,
  package_name text not null,
  credits_amount integer not null,
  price_amount integer not null,
  currency text not null,
  status text not null default 'pending',
  provider text,
  provider_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_orders_credits_amount_check check (credits_amount > 0),
  constraint credit_orders_price_amount_check check (price_amount >= 0),
  constraint credit_orders_status_check check (status in ('pending', 'cancelled'))
);

create index credit_orders_user_id_created_at_idx
  on public.credit_orders(user_id, created_at desc);
create index credit_orders_status_created_at_idx
  on public.credit_orders(status, created_at desc);

create trigger credit_orders_set_updated_at
before update on public.credit_orders
for each row execute function public.set_updated_at();

alter table public.credit_orders enable row level security;

create policy "credit_orders select own"
on public.credit_orders
for select
to authenticated
using (user_id = auth.uid());

create policy "credit_orders insert own"
on public.credit_orders
for insert
to authenticated
with check (user_id = auth.uid());

create unique index credit_transactions_generation_log_id_unique_idx
  on public.credit_transactions(generation_log_id)
  where generation_log_id is not null;

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

  if p_generation_log_id is not null then
    perform pg_advisory_xact_lock(hashtext(p_generation_log_id::text));

    select id, credit_transactions.balance_after
      into v_transaction_id, v_balance_after
    from public.credit_transactions
    where generation_log_id = p_generation_log_id
      and user_id = v_user_id
      and status = 'succeeded'
    limit 1;

    if v_transaction_id is not null then
      return query select v_transaction_id, v_balance_after;
      return;
    end if;
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

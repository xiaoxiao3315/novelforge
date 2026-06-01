alter table public.credit_orders
  add column if not exists paid_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists provider_payload jsonb,
  add column if not exists checkout_url text,
  add column if not exists idempotency_key text,
  add column if not exists credit_transaction_id uuid references public.credit_transactions(id) on delete set null;

alter table public.credit_orders
  drop constraint if exists credit_orders_status_check;

alter table public.credit_orders
  add constraint credit_orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'));

alter table public.credit_orders
  drop constraint if exists credit_orders_provider_check;

alter table public.credit_orders
  add constraint credit_orders_provider_check
  check (provider is null or provider in ('placeholder', 'stripe', 'wechat', 'alipay'));

create unique index if not exists credit_orders_provider_order_id_unique_idx
  on public.credit_orders(provider_order_id)
  where provider_order_id is not null;

create unique index if not exists credit_orders_user_id_idempotency_key_unique_idx
  on public.credit_orders(user_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists credit_orders_user_package_provider_pending_unique_idx
  on public.credit_orders(user_id, package_name, provider)
  where status = 'pending';

create unique index if not exists credit_orders_credit_transaction_id_unique_idx
  on public.credit_orders(credit_transaction_id)
  where credit_transaction_id is not null;

alter table public.credit_transactions
  add column if not exists order_id uuid references public.credit_orders(id) on delete set null;

create index if not exists credit_transactions_order_id_idx
  on public.credit_transactions(order_id);

create unique index if not exists credit_transactions_purchase_order_id_unique_idx
  on public.credit_transactions(order_id)
  where order_id is not null
    and operation = 'purchase_credits';

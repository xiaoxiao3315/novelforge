create or replace function public.mock_complete_credit_order(
  p_order_id uuid,
  p_order_no text,
  p_result text
)
returns table(
  order_id uuid,
  order_no text,
  status text,
  credit_transaction_id uuid,
  balance_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.credit_orders%rowtype;
  v_balance_after integer;
  v_transaction_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_result not in ('success', 'failed', 'cancelled') then
    raise exception 'unsupported mock payment result';
  end if;

  if p_order_id is null and nullif(trim(coalesce(p_order_no, '')), '') is null then
    raise exception 'order identifier is required';
  end if;

  select co.*
  into v_order
  from public.credit_orders co
  where co.user_id = v_user_id
    and (
      (p_order_id is not null and co.id = p_order_id)
      or (p_order_id is null and p_order_no is not null and co.order_no = p_order_no)
    )
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if p_result = 'success' then
    if v_order.status = 'paid' then
      if v_order.credit_transaction_id is not null then
        select ct.balance_after
        into v_balance_after
        from public.credit_transactions ct
        where ct.id = v_order.credit_transaction_id
          and ct.user_id = v_user_id;
      end if;

      if v_balance_after is null then
        select balance
        into v_balance_after
        from public.credit_accounts
        where user_id = v_user_id;
      end if;

      return query
      select v_order.id, v_order.order_no, v_order.status, v_order.credit_transaction_id, v_balance_after;
      return;
    end if;

    if v_order.status <> 'pending' then
      raise exception 'order is not pending';
    end if;

    if v_order.credits_amount <= 0 then
      raise exception 'order credits amount must be positive';
    end if;

    insert into public.credit_accounts(user_id)
    values (v_user_id)
    on conflict (user_id) do nothing;

    update public.credit_accounts
    set balance = balance + v_order.credits_amount
    where user_id = v_user_id
    returning balance into v_balance_after;

    if v_balance_after is null then
      raise exception 'credit account update failed';
    end if;

    insert into public.credit_transactions(
      user_id,
      project_id,
      generation_log_id,
      order_id,
      operation,
      amount,
      balance_after,
      reason,
      status
    )
    values (
      v_user_id,
      null,
      null,
      v_order.id,
      'purchase_credits',
      v_order.credits_amount,
      v_balance_after,
      'Mock 支付成功入账',
      'succeeded'
    )
    returning id into v_transaction_id;

    update public.credit_orders
    set
      status = 'paid',
      paid_at = now(),
      credit_transaction_id = v_transaction_id,
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'mockResult', 'success',
        'mockCompletedAt', now()
      )
    where id = v_order.id
    returning credit_orders.status, credit_orders.credit_transaction_id
    into v_order.status, v_order.credit_transaction_id;

    return query
    select v_order.id, v_order.order_no, v_order.status, v_order.credit_transaction_id, v_balance_after;
    return;
  end if;

  if v_order.status <> 'pending' then
    raise exception 'order is not pending';
  end if;

  if p_result = 'failed' then
    update public.credit_orders
    set
      status = 'failed',
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'mockResult', 'failed',
        'mockCompletedAt', now()
      )
    where id = v_order.id
    returning credit_orders.status
    into v_order.status;
  elsif p_result = 'cancelled' then
    update public.credit_orders
    set
      status = 'cancelled',
      cancelled_at = now(),
      provider_payload = coalesce(provider_payload, '{}'::jsonb) || jsonb_build_object(
        'mockResult', 'cancelled',
        'mockCompletedAt', now()
      )
    where id = v_order.id
    returning credit_orders.status
    into v_order.status;
  end if;

  select balance
  into v_balance_after
  from public.credit_accounts
  where user_id = v_user_id;

  return query
  select v_order.id, v_order.order_no, v_order.status, null::uuid, v_balance_after;
end;
$$;

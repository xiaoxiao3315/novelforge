-- WO017: charge-before-save support + transactional chapter RPCs
--
-- 1. Split the unique generation_log_id index so each log allows one spend
--    (amount < 0) and one refund (amount > 0).
-- 2. spend_generation_credits: idempotency lookup now only matches spend rows.
-- 3. refund_generation_credits: service-role-only idempotent compensation
--    when content saving fails after a successful charge.
-- 4. set_official_chapter_version: atomic official-version switch.
-- 5. apply_chapter_decision: atomic decision + interactive state + stale marks.
-- 6. save_story_bible_generation / save_outline_generation: atomic paid saves.

drop index if exists public.credit_transactions_generation_log_id_unique_idx;

create unique index credit_transactions_spend_per_log_unique_idx
  on public.credit_transactions(generation_log_id)
  where generation_log_id is not null and amount < 0;

create unique index credit_transactions_refund_per_log_unique_idx
  on public.credit_transactions(generation_log_id)
  where generation_log_id is not null and amount > 0;

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
      and amount < 0
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

drop function if exists public.refund_generation_credits(uuid, text);

create or replace function public.refund_generation_credits(
  p_generation_log_id uuid,
  p_user_id uuid,
  p_reason text default '生成内容保存失败，自动退还'
)
returns table(transaction_id uuid, balance_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := p_user_id;
  v_spend record;
  v_balance_after integer;
  v_transaction_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'refund_generation_credits requires service_role';
  end if;

  if v_user_id is null then
    raise exception 'user id is required';
  end if;

  if p_generation_log_id is null then
    raise exception 'generation log id is required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_generation_log_id::text));

  select t.id, t.project_id, t.operation, t.amount
    into v_spend
  from public.credit_transactions t
  where t.generation_log_id = p_generation_log_id
    and t.user_id = v_user_id
    and t.status = 'succeeded'
    and t.amount < 0
  limit 1;

  if v_spend is null then
    raise exception 'no spend transaction found for this generation log';
  end if;

  select t.id, t.balance_after
    into v_transaction_id, v_balance_after
  from public.credit_transactions t
  where t.generation_log_id = p_generation_log_id
    and t.user_id = v_user_id
    and t.status = 'succeeded'
    and t.amount > 0
  limit 1;

  if v_transaction_id is not null then
    return query select v_transaction_id, v_balance_after;
    return;
  end if;

  update public.credit_accounts
  set balance = balance - v_spend.amount
  where user_id = v_user_id
  returning balance into v_balance_after;

  if v_balance_after is null then
    raise exception 'credit account not found';
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
    v_spend.project_id,
    p_generation_log_id,
    v_spend.operation,
    -v_spend.amount,
    v_balance_after,
    p_reason,
    'succeeded'
  )
  returning id into v_transaction_id;

  return query select v_transaction_id, v_balance_after;
end;
$$;

revoke all on function public.refund_generation_credits(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function public.refund_generation_credits(uuid, uuid, text)
to service_role;

create or replace function public.assert_paid_generation_log(
  p_project_id uuid,
  p_generation_log_id uuid,
  p_operation text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.generation_logs gl
    where gl.id = p_generation_log_id
      and gl.project_id = p_project_id
      and gl.user_id = p_user_id
      and gl.operation = p_operation
  ) then
    raise exception 'generation log does not belong to current operation';
  end if;

  if not exists (
    select 1
    from public.credit_transactions ct
    where ct.generation_log_id = p_generation_log_id
      and ct.project_id = p_project_id
      and ct.user_id = p_user_id
      and ct.status = 'succeeded'
      and ct.amount < 0
  ) then
    raise exception 'generation log has not been charged';
  end if;
end;
$$;

revoke all on function public.assert_paid_generation_log(uuid, uuid, text, uuid)
from public, anon, authenticated;

create or replace function public.save_story_bible_generation(
  p_project_id uuid,
  p_generation_log_id uuid,
  p_bible jsonb,
  p_characters jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_story_bible_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_bible is null or jsonb_typeof(p_bible) <> 'object' then
    raise exception 'bible payload must be a json object';
  end if;

  if p_characters is null or jsonb_typeof(p_characters) <> 'array' then
    raise exception 'characters payload must be a json array';
  end if;

  perform 1
  from public.projects
  where id = p_project_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'project not found';
  end if;

  perform public.assert_paid_generation_log(
    p_project_id,
    p_generation_log_id,
    'generate_bible',
    v_user_id
  );

  insert into public.story_bibles(
    project_id,
    user_id,
    worldview,
    power_system,
    major_factions,
    main_plot,
    first_volume_plot,
    protagonist_arc,
    antagonist_plan,
    mid_late_foreshadowing,
    final_truth,
    immutable_rules,
    content
  )
  values (
    p_project_id,
    v_user_id,
    p_bible->>'worldview',
    p_bible->>'powerSystem',
    p_bible->>'majorFactions',
    p_bible->>'mainPlot',
    p_bible->>'firstVolumePlot',
    p_bible->>'protagonistArc',
    p_bible->>'antagonistPlan',
    p_bible->>'midLateForeshadowing',
    p_bible->>'finalTruth',
    coalesce(
      (
        select string_agg('- ' || value, E'\n')
        from jsonb_array_elements_text(coalesce(p_bible->'immutableRules', '[]'::jsonb)) as value
      ),
      ''
    ),
    p_bible
  )
  on conflict (project_id) do update
  set
    worldview = excluded.worldview,
    power_system = excluded.power_system,
    major_factions = excluded.major_factions,
    main_plot = excluded.main_plot,
    first_volume_plot = excluded.first_volume_plot,
    protagonist_arc = excluded.protagonist_arc,
    antagonist_plan = excluded.antagonist_plan,
    mid_late_foreshadowing = excluded.mid_late_foreshadowing,
    final_truth = excluded.final_truth,
    immutable_rules = excluded.immutable_rules,
    content = excluded.content
  returning id into v_story_bible_id;

  delete from public.characters
  where project_id = p_project_id
    and user_id = v_user_id;

  insert into public.characters(
    project_id,
    user_id,
    name,
    role,
    appearance,
    personality,
    goal,
    weakness,
    secret,
    relationship_to_protagonist,
    character_arc,
    sort_order,
    content
  )
  select
    p_project_id,
    v_user_id,
    item->>'name',
    item->>'role',
    item->>'appearance',
    item->>'personality',
    item->>'goal',
    item->>'weakness',
    item->>'secret',
    item->>'relationshipToProtagonist',
    item->>'characterArc',
    ordinality::integer - 1,
    item
  from jsonb_array_elements(p_characters) with ordinality as character_items(item, ordinality);

  update public.generation_logs
  set
    target_id = v_story_bible_id,
    output = jsonb_build_object(
      'bible', p_bible,
      'characters', p_characters
    )
  where id = p_generation_log_id
    and user_id = v_user_id;

  return v_story_bible_id;
end;
$$;

create or replace function public.save_outline_generation(
  p_project_id uuid,
  p_generation_log_id uuid,
  p_volume jsonb,
  p_chapters jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_volume_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_volume is null or jsonb_typeof(p_volume) <> 'object' then
    raise exception 'volume payload must be a json object';
  end if;

  if p_chapters is null or jsonb_typeof(p_chapters) <> 'array' then
    raise exception 'chapters payload must be a json array';
  end if;

  perform 1
  from public.projects
  where id = p_project_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'project not found';
  end if;

  perform public.assert_paid_generation_log(
    p_project_id,
    p_generation_log_id,
    'generate_outline',
    v_user_id
  );

  insert into public.volumes(
    project_id,
    user_id,
    volume_number,
    title,
    summary,
    main_conflict,
    ending_hook,
    content
  )
  values (
    p_project_id,
    v_user_id,
    (p_volume->>'volumeNumber')::integer,
    p_volume->>'title',
    p_volume->>'summary',
    p_volume->>'mainConflict',
    p_volume->>'endingHook',
    p_volume
  )
  on conflict (project_id, volume_number) do update
  set
    title = excluded.title,
    summary = excluded.summary,
    main_conflict = excluded.main_conflict,
    ending_hook = excluded.ending_hook,
    content = excluded.content
  returning id into v_volume_id;

  insert into public.chapters(
    project_id,
    user_id,
    volume_id,
    chapter_number,
    title,
    event,
    conflict,
    character_change,
    highlight,
    foreshadowing,
    ending_hook,
    estimated_words,
    content
  )
  select
    p_project_id,
    v_user_id,
    v_volume_id,
    (item->>'chapterNumber')::integer,
    item->>'title',
    item->>'event',
    item->>'conflict',
    item->>'characterChange',
    item->>'highlight',
    item->>'foreshadowing',
    item->>'endingHook',
    (item->>'estimatedWords')::integer,
    item
  from jsonb_array_elements(p_chapters) as chapter_items(item)
  on conflict (project_id, chapter_number) do update
  set
    volume_id = excluded.volume_id,
    title = excluded.title,
    event = excluded.event,
    conflict = excluded.conflict,
    character_change = excluded.character_change,
    highlight = excluded.highlight,
    foreshadowing = excluded.foreshadowing,
    ending_hook = excluded.ending_hook,
    estimated_words = excluded.estimated_words,
    content = excluded.content;

  update public.generation_logs
  set
    target_id = v_volume_id,
    output = jsonb_build_object(
      'volume', p_volume,
      'chapters', p_chapters
    )
  where id = p_generation_log_id
    and user_id = v_user_id;

  return v_volume_id;
end;
$$;

create or replace function public.set_official_chapter_version(
  p_project_id uuid,
  p_chapter_id uuid,
  p_version_id uuid,
  p_official jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_official is null or jsonb_typeof(p_official) <> 'object' then
    raise exception 'official payload must be a json object';
  end if;

  perform 1
  from public.chapters
  where id = p_chapter_id
    and project_id = p_project_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'chapter not found';
  end if;

  if not exists (
    select 1
    from public.chapter_versions
    where id = p_version_id
      and chapter_id = p_chapter_id
      and project_id = p_project_id
      and user_id = v_user_id
  ) then
    raise exception 'chapter version not found';
  end if;

  update public.chapter_versions
  set is_official = false
  where chapter_id = p_chapter_id
    and user_id = v_user_id
    and is_official;

  update public.chapter_versions
  set is_official = true
  where id = p_version_id
    and user_id = v_user_id;

  update public.chapters
  set content = coalesce(content, '{}'::jsonb) || jsonb_build_object('official', p_official)
  where id = p_chapter_id
    and project_id = p_project_id
    and user_id = v_user_id;
end;
$$;

create or replace function public.apply_chapter_decision(
  p_project_id uuid,
  p_chapter_id uuid,
  p_chapter_content jsonb,
  p_config_json jsonb,
  p_stale_chapters jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_stale record;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_chapter_content is null or jsonb_typeof(p_chapter_content) <> 'object' then
    raise exception 'chapter content must be a json object';
  end if;

  if p_config_json is null or jsonb_typeof(p_config_json) <> 'object' then
    raise exception 'config json must be a json object';
  end if;

  if p_stale_chapters is null or jsonb_typeof(p_stale_chapters) <> 'array' then
    raise exception 'stale chapters must be a json array';
  end if;

  perform 1
  from public.chapters
  where id = p_chapter_id
    and project_id = p_project_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'chapter not found';
  end if;

  update public.chapters
  set content = p_chapter_content
  where id = p_chapter_id
    and project_id = p_project_id
    and user_id = v_user_id;

  update public.story_configs
  set config_json = p_config_json
  where project_id = p_project_id
    and user_id = v_user_id;

  if not found then
    raise exception 'story config not found';
  end if;

  for v_stale in
    select
      (item->>'id')::uuid as chapter_id,
      item->'content' as content
    from jsonb_array_elements(p_stale_chapters) as item
  loop
    if v_stale.chapter_id is null
      or v_stale.content is null
      or jsonb_typeof(v_stale.content) <> 'object' then
      raise exception 'invalid stale chapter payload';
    end if;

    update public.chapters
    set content = v_stale.content
    where id = v_stale.chapter_id
      and project_id = p_project_id
      and user_id = v_user_id;

    if not found then
      raise exception 'stale chapter % not found', v_stale.chapter_id;
    end if;
  end loop;
end;
$$;

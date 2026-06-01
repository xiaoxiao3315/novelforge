create table public.story_bibles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  worldview text,
  power_system text,
  major_factions text,
  main_plot text,
  first_volume_plot text,
  protagonist_arc text,
  antagonist_plan text,
  mid_late_foreshadowing text,
  final_truth text,
  immutable_rules text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_bibles_project_id_unique unique (project_id),
  constraint story_bibles_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  role text,
  appearance text,
  personality text,
  goal text,
  weakness text,
  secret text,
  relationship_to_protagonist text,
  character_arc text,
  sort_order integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create index story_bibles_project_id_idx on public.story_bibles(project_id);
create index story_bibles_user_id_idx on public.story_bibles(user_id);
create index characters_project_id_sort_order_idx on public.characters(project_id, sort_order);
create index characters_user_id_idx on public.characters(user_id);

create trigger story_bibles_set_updated_at
before update on public.story_bibles
for each row execute function public.set_updated_at();

create trigger characters_set_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

alter table public.story_bibles enable row level security;
alter table public.characters enable row level security;

create policy "story_bibles select own"
on public.story_bibles
for select
to authenticated
using (user_id = auth.uid());

create policy "story_bibles insert own"
on public.story_bibles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "story_bibles update own"
on public.story_bibles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "story_bibles delete own"
on public.story_bibles
for delete
to authenticated
using (user_id = auth.uid());

create policy "characters select own"
on public.characters
for select
to authenticated
using (user_id = auth.uid());

create policy "characters insert own"
on public.characters
for insert
to authenticated
with check (user_id = auth.uid());

create policy "characters update own"
on public.characters
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "characters delete own"
on public.characters
for delete
to authenticated
using (user_id = auth.uid());

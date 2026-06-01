create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_status_check check (status in ('draft', 'active', 'archived')),
  constraint projects_id_user_id_unique unique (id, user_id)
);

create table public.story_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  theme text,
  genre text,
  background text,
  world_setting text,
  protagonist text,
  core_conflict text,
  tone text,
  serial_structure text,
  extra_ideas text,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_configs_project_id_unique unique (project_id),
  constraint story_configs_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create table public.story_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  logline text,
  protagonist text,
  world_rules text,
  core_conflict text,
  first_volume_hook text,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_concepts_project_id_unique unique (project_id),
  constraint story_concepts_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create table public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  operation text not null,
  target_type text,
  target_id uuid,
  model text,
  prompt_version text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  constraint generation_logs_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create index projects_user_id_idx on public.projects(user_id);
create index story_configs_project_id_idx on public.story_configs(project_id);
create index story_configs_user_id_idx on public.story_configs(user_id);
create index story_concepts_project_id_idx on public.story_concepts(project_id);
create index story_concepts_user_id_idx on public.story_concepts(user_id);
create index generation_logs_project_id_created_at_idx
  on public.generation_logs(project_id, created_at desc);
create index generation_logs_user_id_created_at_idx
  on public.generation_logs(user_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger story_configs_set_updated_at
before update on public.story_configs
for each row execute function public.set_updated_at();

create trigger story_concepts_set_updated_at
before update on public.story_concepts
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.story_configs enable row level security;
alter table public.story_concepts enable row level security;
alter table public.generation_logs enable row level security;

create policy "profiles select own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles update own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "projects select own"
on public.projects
for select
to authenticated
using (user_id = auth.uid());

create policy "projects insert own"
on public.projects
for insert
to authenticated
with check (user_id = auth.uid());

create policy "projects update own"
on public.projects
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "projects delete own"
on public.projects
for delete
to authenticated
using (user_id = auth.uid());

create policy "story_configs select own"
on public.story_configs
for select
to authenticated
using (user_id = auth.uid());

create policy "story_configs insert own"
on public.story_configs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "story_configs update own"
on public.story_configs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "story_configs delete own"
on public.story_configs
for delete
to authenticated
using (user_id = auth.uid());

create policy "story_concepts select own"
on public.story_concepts
for select
to authenticated
using (user_id = auth.uid());

create policy "story_concepts insert own"
on public.story_concepts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "story_concepts update own"
on public.story_concepts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "story_concepts delete own"
on public.story_concepts
for delete
to authenticated
using (user_id = auth.uid());

create policy "generation_logs select own"
on public.generation_logs
for select
to authenticated
using (user_id = auth.uid());

create policy "generation_logs insert own"
on public.generation_logs
for insert
to authenticated
with check (user_id = auth.uid());

create policy "generation_logs update own"
on public.generation_logs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "generation_logs delete own"
on public.generation_logs
for delete
to authenticated
using (user_id = auth.uid());

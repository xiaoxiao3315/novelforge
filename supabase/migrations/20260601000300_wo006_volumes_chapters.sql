create table public.volumes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  volume_number integer not null default 1,
  title text not null,
  summary text not null,
  main_conflict text not null,
  ending_hook text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volumes_volume_number_check check (volume_number > 0),
  constraint volumes_project_volume_number_unique unique (project_id, volume_number),
  constraint volumes_id_project_user_unique unique (id, project_id, user_id),
  constraint volumes_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  volume_id uuid not null,
  chapter_number integer not null,
  title text not null,
  event text not null,
  conflict text not null,
  character_change text not null,
  highlight text not null,
  foreshadowing text not null,
  ending_hook text not null,
  estimated_words integer not null default 2500,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chapters_chapter_number_check check (chapter_number > 0),
  constraint chapters_estimated_words_check check (estimated_words between 1000 and 5000),
  constraint chapters_project_chapter_number_unique unique (project_id, chapter_number),
  constraint chapters_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  constraint chapters_volume_owner_fk
    foreign key (volume_id, project_id, user_id)
    references public.volumes(id, project_id, user_id)
    on delete cascade
);

create index volumes_project_id_idx on public.volumes(project_id);
create index volumes_user_id_idx on public.volumes(user_id);
create index chapters_project_id_chapter_number_idx on public.chapters(project_id, chapter_number);
create index chapters_volume_id_chapter_number_idx on public.chapters(volume_id, chapter_number);
create index chapters_user_id_idx on public.chapters(user_id);

create trigger volumes_set_updated_at
before update on public.volumes
for each row execute function public.set_updated_at();

create trigger chapters_set_updated_at
before update on public.chapters
for each row execute function public.set_updated_at();

alter table public.volumes enable row level security;
alter table public.chapters enable row level security;

create policy "volumes select own"
on public.volumes
for select
to authenticated
using (user_id = auth.uid());

create policy "volumes insert own"
on public.volumes
for insert
to authenticated
with check (user_id = auth.uid());

create policy "volumes update own"
on public.volumes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "volumes delete own"
on public.volumes
for delete
to authenticated
using (user_id = auth.uid());

create policy "chapters select own"
on public.chapters
for select
to authenticated
using (user_id = auth.uid());

create policy "chapters insert own"
on public.chapters
for insert
to authenticated
with check (user_id = auth.uid());

create policy "chapters update own"
on public.chapters
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "chapters delete own"
on public.chapters
for delete
to authenticated
using (user_id = auth.uid());

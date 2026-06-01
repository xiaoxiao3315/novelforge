alter table public.chapters
add constraint chapters_id_project_user_unique unique (id, project_id, user_id);

create table public.chapter_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  chapter_id uuid not null,
  version_number integer not null,
  body text not null,
  summary jsonb not null default '{}'::jsonb,
  intervention jsonb not null default '{}'::jsonb,
  model text not null,
  prompt_version text not null,
  is_official boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chapter_versions_version_number_check check (version_number > 0),
  constraint chapter_versions_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  constraint chapter_versions_chapter_owner_fk
    foreign key (chapter_id, project_id, user_id)
    references public.chapters(id, project_id, user_id)
    on delete cascade,
  constraint chapter_versions_chapter_version_unique unique (chapter_id, user_id, version_number)
);

create unique index chapter_versions_one_official_per_chapter_idx
  on public.chapter_versions(chapter_id, user_id)
  where is_official;

create index chapter_versions_project_id_chapter_id_idx
  on public.chapter_versions(project_id, chapter_id);
create index chapter_versions_user_id_created_at_idx
  on public.chapter_versions(user_id, created_at desc);

alter table public.chapter_versions enable row level security;

create policy "chapter_versions select own"
on public.chapter_versions
for select
to authenticated
using (user_id = auth.uid());

create policy "chapter_versions insert own"
on public.chapter_versions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "chapter_versions update own"
on public.chapter_versions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "chapter_versions delete own"
on public.chapter_versions
for delete
to authenticated
using (user_id = auth.uid());

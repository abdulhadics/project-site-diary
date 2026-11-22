begin;

create table public.projects (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  name text not null check (char_length(btrim(name)) between 1 and 64),
  company_name text check (char_length(company_name) <= 60),
  prepared_by text check (char_length(prepared_by) <= 60),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index projects_user_id_idx on public.projects (user_id);

create table public.entries (
  id uuid primary key,
  project_id uuid not null,
  user_id uuid not null,
  report_date date not null,
  created_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  unique (project_id, report_date),
  unique (id, project_id, user_id)
);

create index entries_user_id_idx on public.entries (user_id);

create table public.photos (
  id uuid primary key,
  entry_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision not null check (accuracy >= 0 and accuracy < 'Infinity'::float8),
  captured_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 1000),
  description text not null default '' check (char_length(description) <= 240),
  description_approved_at timestamptz,
  ai_ok boolean,
  storage_path text not null unique,
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  foreign key (entry_id, project_id, user_id) references public.entries (id, project_id, user_id),
  check (storage_path = user_id::text || '/' || project_id::text || '/photos/' || id::text || '.jpg'),
  check (description_approved_at is null or char_length(btrim(description)) > 0)
);

create index photos_user_capture_idx on public.photos (user_id, captured_at);

create table public.reports (
  id uuid primary key,
  project_id uuid not null,
  user_id uuid not null,
  report_date date not null,
  pdf_path text not null unique,
  size_bytes integer not null check (size_bytes between 1 and 15728640),
  created_at timestamptz not null default now(),
  foreign key (project_id, report_date) references public.entries (project_id, report_date),
  foreign key (project_id, user_id) references public.projects (id, user_id),
  check (pdf_path = user_id::text || '/' || project_id::text || '/reports/' || id::text || '.pdf')
);

create index reports_user_day_idx on public.reports (user_id, report_date, created_at desc);

alter table public.projects enable row level security;
alter table public.entries enable row level security;
alter table public.photos enable row level security;
alter table public.reports enable row level security;

revoke all on public.projects, public.entries, public.photos, public.reports from anon, authenticated;
grant select, insert, update on public.projects, public.entries to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert, update, delete on public.photos to authenticated;

create policy "Owner accesses projects" on public.projects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owner accesses entries" on public.entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owner accesses photos" on public.photos for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owner accesses reports" on public.reports for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-diary', 'site-diary', false, 15728640, array['image/jpeg', 'application/pdf']);

create policy "Owner reads diary files" on storage.objects for select to authenticated
  using (bucket_id = 'site-diary' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner uploads diary files" on storage.objects for insert to authenticated
  with check (bucket_id = 'site-diary' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner deletes diary photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-diary' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[3] = 'photos'
  );

create function public.diary_storage_bytes() returns bigint
language sql stable
set search_path = ''
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
  from storage.objects
  where bucket_id = 'site-diary'
    and (storage.foldername(name))[1] = (select auth.uid())::text;
$$;

revoke all on function public.diary_storage_bytes() from public, anon;
grant execute on function public.diary_storage_bytes() to authenticated;

commit;

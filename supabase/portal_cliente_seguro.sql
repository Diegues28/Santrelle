-- Área do Cliente Santrelle. Execute apenas no projeto Supabase da Santrelle.
-- Primeiro crie uma conta de equipe pelo Auth; depois cadastre seu UUID em
-- public.portal_staff pelo SQL Editor (nunca use uma chave service_role no site).

create extension if not exists pgcrypto;
create schema if not exists portal_private;

create table if not exists public.portal_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function portal_private.portal_on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.portal_profiles(user_id,email)
 values(new.id,coalesce(new.email,''))
 on conflict(user_id) do update set email=excluded.email;
 return new;
end;
$$;
revoke all on function portal_private.portal_on_auth_user_created() from public, anon, authenticated;
drop trigger if exists portal_auth_user_created on auth.users;
create trigger portal_auth_user_created after insert or update of email on auth.users
for each row execute function portal_private.portal_on_auth_user_created();
insert into public.portal_profiles(user_id,email)
select id,coalesce(email,'') from auth.users
on conflict(user_id) do update set email=excluded.email;

create table if not exists public.portal_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_label text not null,
  current_stage text,
  created_at timestamptz not null default now()
);
create table if not exists public.portal_project_members (
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(project_id,user_id)
);
create table if not exists public.portal_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  released boolean not null default false
);
create table if not exists public.portal_folders (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.portal_stages(id) on delete cascade,
  label text not null,
  position integer not null default 0,
  released boolean not null default false
);
create table if not exists public.portal_documents (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.portal_folders(id) on delete cascade,
  title text not null,
  storage_path text not null unique,
  released boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.portal_meetings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portal_projects(id) on delete cascade,
  subject text not null,
  starts_at timestamptz not null,
  location text,
  released boolean not null default false
);

create or replace function public.portal_is_staff()
returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.portal_staff s where s.user_id=(select auth.uid()))
$$;
create or replace function public.portal_is_member(pid uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.portal_project_members m
   where m.project_id=pid and m.user_id=(select auth.uid()))
$$;

alter table public.portal_staff enable row level security;
alter table public.portal_profiles enable row level security;
alter table public.portal_projects enable row level security;
alter table public.portal_project_members enable row level security;
alter table public.portal_stages enable row level security;
alter table public.portal_folders enable row level security;
alter table public.portal_documents enable row level security;
alter table public.portal_meetings enable row level security;

create policy portal_staff_self on public.portal_staff for select to authenticated
using (user_id=(select auth.uid()));
create policy portal_profiles_self_or_staff on public.portal_profiles for select to authenticated
using (user_id=(select auth.uid()) or (select public.portal_is_staff()));
create policy portal_projects_read on public.portal_projects for select to authenticated
using ((select public.portal_is_staff()) or public.portal_is_member(id));
create policy portal_members_read on public.portal_project_members for select to authenticated
using ((select public.portal_is_staff()) or user_id=(select auth.uid()));
create policy portal_stages_read on public.portal_stages for select to authenticated
using ((select public.portal_is_staff()) or
 (released and public.portal_is_member(project_id)));
create policy portal_folders_read on public.portal_folders for select to authenticated
using ((select public.portal_is_staff()) or (released and exists(
 select 1 from public.portal_stages s where s.id=stage_id and s.released
 and public.portal_is_member(s.project_id))));
create policy portal_documents_read on public.portal_documents for select to authenticated
using ((select public.portal_is_staff()) or (released and exists(
 select 1 from public.portal_folders f
 join public.portal_stages s on s.id=f.stage_id
 where f.id=folder_id and f.released and s.released
 and public.portal_is_member(s.project_id))));
create policy portal_meetings_read on public.portal_meetings for select to authenticated
using ((select public.portal_is_staff()) or (released and public.portal_is_member(project_id)));

create policy portal_projects_staff_write on public.portal_projects for all to authenticated
using ((select public.portal_is_staff())) with check ((select public.portal_is_staff()));
create policy portal_members_staff_write on public.portal_project_members for all to authenticated
using ((select public.portal_is_staff())) with check ((select public.portal_is_staff()));
create policy portal_stages_staff_write on public.portal_stages for all to authenticated
using ((select public.portal_is_staff())) with check ((select public.portal_is_staff()));
create policy portal_folders_staff_write on public.portal_folders for all to authenticated
using ((select public.portal_is_staff())) with check ((select public.portal_is_staff()));
create policy portal_documents_staff_write on public.portal_documents for all to authenticated
using ((select public.portal_is_staff())) with check ((select public.portal_is_staff()));
create policy portal_meetings_staff_write on public.portal_meetings for all to authenticated
using ((select public.portal_is_staff())) with check ((select public.portal_is_staff()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('santrelle-clientes','santrelle-clientes',false,52428800,
 array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false;

create policy portal_storage_read on storage.objects for select to authenticated
using (bucket_id='santrelle-clientes' and (
 (select public.portal_is_staff()) or exists(
 select 1 from public.portal_documents d
 join public.portal_folders f on f.id=d.folder_id
 join public.portal_stages s on s.id=f.stage_id
 where d.storage_path=name and d.released and f.released and s.released
 and public.portal_is_member(s.project_id))));
create policy portal_storage_staff_insert on storage.objects for insert to authenticated
with check (bucket_id='santrelle-clientes' and (select public.portal_is_staff()));
create policy portal_storage_staff_update on storage.objects for update to authenticated
using (bucket_id='santrelle-clientes' and (select public.portal_is_staff()))
with check (bucket_id='santrelle-clientes' and (select public.portal_is_staff()));
create policy portal_storage_staff_delete on storage.objects for delete to authenticated
using (bucket_id='santrelle-clientes' and (select public.portal_is_staff()));

grant usage on schema public to authenticated;
grant select on public.portal_staff,public.portal_profiles,public.portal_projects,
 public.portal_project_members,public.portal_stages,public.portal_folders,
 public.portal_documents,public.portal_meetings to authenticated;
grant insert,update,delete on public.portal_projects,public.portal_project_members,
 public.portal_stages,public.portal_folders,public.portal_documents,public.portal_meetings to authenticated;
grant execute on function public.portal_is_staff(),public.portal_is_member(uuid) to authenticated;

-- Santrelle Arquitetura | Base segura da Área do Cliente (preparação)
-- IMPORTANTE:
--   1. Execute SOMENTE em um projeto NOVO na organização "Santrelle Arquitetura".
--   2. NÃO execute no projeto da OmniSpectra.
--   3. Este script NÃO cadastra clientes, NÃO libera documentos e NÃO cria links públicos.
--   4. Quem não está na tabela de vínculos de acesso não enxerga qualquer projeto.
--   5. Os documentos permanecem privados mesmo quando a etapa é liberada;
--      só membros autorizados do projeto podem visualizá-los.
--
-- Preparado para aplicação após a criação da organização e do projeto Supabase.

begin;

create table if not exists public.santrelle_portal_projects (
  id uuid primary key default gen_random_uuid(),
  local_project_id text unique,
  name text not null check (length(trim(name)) between 1 and 240),
  created_at timestamptz not null default now()
);

create table if not exists public.santrelle_portal_memberships (
  project_id uuid not null references public.santrelle_portal_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('staff', 'client')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists santrelle_memberships_by_user
  on public.santrelle_portal_memberships (user_id, project_id, role);

create table if not exists public.santrelle_portal_stage_releases (
  project_id uuid not null references public.santrelle_portal_projects(id) on delete cascade,
  stage_key text not null check (stage_key in ('estudo', 'ante', 'executivo', 'obra', 'posobra')),
  released boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (project_id, stage_key)
);

create table if not exists public.santrelle_portal_revision_releases (
  project_id uuid not null references public.santrelle_portal_projects(id) on delete cascade,
  revision_number smallint not null check (revision_number between 1 and 3),
  released boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (project_id, revision_number)
);

create table if not exists public.santrelle_portal_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.santrelle_portal_projects(id) on delete cascade,
  stage_key text not null check (stage_key in ('estudo', 'ante', 'executivo', 'obra', 'posobra')),
  folder_key text not null check (length(trim(folder_key)) between 1 and 100),
  revision_number smallint,
  -- Nunca pode haver arquivo em "Revisão 1/2/3" sem liberação daquela revisão.
  constraint santrelle_revision_folder_matches check (
    (folder_key = 'estudo-revisao-1' and stage_key = 'estudo' and revision_number = 1)
    or (folder_key = 'estudo-revisao-2' and stage_key = 'estudo' and revision_number = 2)
    or (folder_key = 'estudo-revisao-3' and stage_key = 'estudo' and revision_number = 3)
    or (
      folder_key not in ('estudo-revisao-1', 'estudo-revisao-2', 'estudo-revisao-3')
      and revision_number is null
    )
  ),
  title text not null check (length(trim(title)) between 1 and 240),
  original_file_name text not null check (length(trim(original_file_name)) between 1 and 240),
  file_extension text not null check (
    file_extension in ('pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',
                       'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'csv')
  ),
  content_type text not null check (length(trim(content_type)) between 1 and 180),
  is_published boolean not null default false,
  -- Caminho aleatório, sem nome de cliente e impossível de editar diretamente.
  storage_path text generated always as
    (project_id::text || '/' || id::text || '.' || file_extension) stored,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(storage_path)
);

create index if not exists santrelle_documents_project
  on public.santrelle_portal_documents (project_id, stage_key, is_published);

-- Todos os objetos do portal são privados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'santrelle-client-documents',
  'santrelle-client-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv', 'text/plain'
  ]::text[]
)
on conflict (id) do nothing;

-- O bucket não pode ficar público, mesmo que já existisse.
update storage.buckets
set public = false,
    file_size_limit = 52428800
where id = 'santrelle-client-documents';

-- Negação por padrão; papel "anon" sem acesso.
alter table public.santrelle_portal_projects enable row level security;
alter table public.santrelle_portal_memberships enable row level security;
alter table public.santrelle_portal_stage_releases enable row level security;
alter table public.santrelle_portal_revision_releases enable row level security;
alter table public.santrelle_portal_documents enable row level security;

revoke all on public.santrelle_portal_projects,
  public.santrelle_portal_memberships,
  public.santrelle_portal_stage_releases,
  public.santrelle_portal_revision_releases,
  public.santrelle_portal_documents
from anon, authenticated;

grant select on public.santrelle_portal_projects,
  public.santrelle_portal_memberships,
  public.santrelle_portal_stage_releases,
  public.santrelle_portal_revision_releases,
  public.santrelle_portal_documents to authenticated;

grant insert, update on public.santrelle_portal_stage_releases,
  public.santrelle_portal_revision_releases,
  public.santrelle_portal_documents to authenticated;

grant delete on public.santrelle_portal_documents to authenticated;

-- O usuário autenticado enxerga SOMENTE os próprios vínculos.
create policy "santrelle_read_own_memberships"
on public.santrelle_portal_memberships
for select to authenticated
using (user_id = (select auth.uid()));

create policy "santrelle_projects_for_members"
on public.santrelle_portal_projects
for select to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = id and m.user_id = (select auth.uid())
  )
);

-- Uma etapa é visível ao membro do projeto, mas somente equipe altera.
create policy "santrelle_stages_for_members"
on public.santrelle_portal_stage_releases
for select to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_stage_releases.project_id
      and m.user_id = (select auth.uid())
  )
);

create policy "santrelle_staff_insert_stage_release"
on public.santrelle_portal_stage_releases
for insert to authenticated
with check (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_stage_releases.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

create policy "santrelle_staff_update_stage_release"
on public.santrelle_portal_stage_releases
for update to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_stage_releases.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
)
with check (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_stage_releases.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

create policy "santrelle_revisions_for_members"
on public.santrelle_portal_revision_releases
for select to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_revision_releases.project_id
      and m.user_id = (select auth.uid())
  )
);

create policy "santrelle_staff_insert_revision_release"
on public.santrelle_portal_revision_releases
for insert to authenticated
with check (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_revision_releases.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

create policy "santrelle_staff_update_revision_release"
on public.santrelle_portal_revision_releases
for update to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_revision_releases.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
)
with check (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_revision_releases.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

-- Equipe vê seus projetos, cliente vê só documentos publicados
-- em etapas liberadas; revisões exigem liberação própria.
create policy "santrelle_documents_visible_to_authorized_members"
on public.santrelle_portal_documents
for select to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_documents.project_id
      and m.user_id = (select auth.uid())
      and (
        m.role = 'staff'
        or (
          m.role = 'client'
          and santrelle_portal_documents.is_published = true
          and exists (
            select 1 from public.santrelle_portal_stage_releases s
            where s.project_id = santrelle_portal_documents.project_id
              and s.stage_key = santrelle_portal_documents.stage_key
              and s.released = true
          )
          and (
            santrelle_portal_documents.revision_number is null
            or exists (
              select 1 from public.santrelle_portal_revision_releases r
              where r.project_id = santrelle_portal_documents.project_id
                and r.revision_number = santrelle_portal_documents.revision_number
                and r.released = true
            )
          )
        )
      )
  )
);

create policy "santrelle_staff_create_documents"
on public.santrelle_portal_documents
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_documents.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

create policy "santrelle_staff_update_documents"
on public.santrelle_portal_documents
for update to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_documents.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
)
with check (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_documents.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

create policy "santrelle_staff_delete_documents"
on public.santrelle_portal_documents
for delete to authenticated
using (
  exists (
    select 1 from public.santrelle_portal_memberships m
    where m.project_id = santrelle_portal_documents.project_id
      and m.user_id = (select auth.uid()) and m.role = 'staff'
  )
);

-- Storage SELECT herda RLS dos metadados (inclui projeto, etapa,
-- revisão, publicação). Não exponha caminhos sem passar por essa checagem.
create policy "santrelle_storage_read_authorized_documents"
on storage.objects
for select to authenticated
using (
  bucket_id = 'santrelle-client-documents'
  and exists (
    select 1 from public.santrelle_portal_documents d
    where d.storage_path = storage.objects.name
  )
);

-- Upload: somente equipe vinculada e documento previamente registrado.
create policy "santrelle_storage_staff_upload"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'santrelle-client-documents'
  and exists (
    select 1 from public.santrelle_portal_documents d
    join public.santrelle_portal_memberships m
      on m.project_id = d.project_id
    where d.storage_path = storage.objects.name
      and m.user_id = (select auth.uid())
      and m.role = 'staff'
  )
);

-- Nesta primeira versão, substituição/exclusão física de arquivos fica
-- bloqueada pelo cliente; equipes poderão criar nova versão e arquivar
-- a anterior. Regras de substituição serão definidas separadamente.

commit;

-- Validação inicial (execute depois, somente no projeto Santrelle):
-- select id, public, file_size_limit
--   from storage.buckets where id='santrelle-client-documents';
-- select tablename, rowsecurity
--   from pg_tables where schemaname='public'
--     and tablename like 'santrelle_portal_%';
-- select schemaname, tablename, policyname, cmd
--   from pg_policies where tablename like 'santrelle_%';

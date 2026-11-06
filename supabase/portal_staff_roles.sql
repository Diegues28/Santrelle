-- Permissões da equipe Santrelle.
alter table public.portal_staff
 add column if not exists role text not null default 'colaborador';
alter table public.portal_staff
 drop constraint if exists portal_staff_role_check;
alter table public.portal_staff
 add constraint portal_staff_role_check check(role in ('admin','colaborador'));

create or replace function public.portal_is_admin()
returns boolean language sql stable security invoker set search_path = '' as $$
 select exists(select 1 from public.portal_staff s
   where s.user_id=(select auth.uid()) and s.role='admin')
$$;
grant execute on function public.portal_is_admin() to authenticated;

-- LOCAL ONLY. Global monitoring authorization is separate from server roles.
create table public.performance_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.performance_admins enable row level security;
revoke all on public.performance_admins from public, anon, authenticated;
-- Provision/revoke ONLY with privileged SQL. No auto-grant to a server owner.
create or replace function public.is_performance_admin()
returns boolean language sql stable security definer
set search_path = pg_catalog as $$
  select auth.uid() is not null and exists (
    select 1 from public.performance_admins where user_id = auth.uid()
  );
$$;
revoke all on function public.is_performance_admin() from public, anon;
grant execute on function public.is_performance_admin() to authenticated;
-- Metrics stay on the administrator's device in V1. No ingest endpoint is created.

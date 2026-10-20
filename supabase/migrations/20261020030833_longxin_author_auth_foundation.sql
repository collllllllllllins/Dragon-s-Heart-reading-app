create table public.longxin_authors (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
comment on table public.longxin_authors is 'Dragon Heart author allowlist. Managed only by the project administrator; clients cannot grant themselves access.';
alter table public.longxin_authors enable row level security;
revoke all on table public.longxin_authors from public, anon, authenticated;
grant select on table public.longxin_authors to authenticated;
grant all on table public.longxin_authors to service_role;
create policy "Authors can check only their own membership"
 on public.longxin_authors for select to authenticated
 using ((select auth.uid()) = user_id);
create function public.longxin_cloud_version()
 returns integer language sql immutable security invoker
 set search_path = ''
 as $$ select 1; $$;
revoke all on function public.longxin_cloud_version() from public;
grant execute on function public.longxin_cloud_version() to anon, authenticated, service_role;

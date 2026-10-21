create table public.longxin_backups (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 chapter_count integer not null check (chapter_count between 0 and 1000),
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'format' = 'longxin-backup-v1' and jsonb_typeof(payload->'chapters') = 'array' and jsonb_array_length(payload->'chapters') = chapter_count and octet_length(payload::text) <= 50000000)
);
create index longxin_backups_owner_created on public.longxin_backups(user_id, created_at desc);
alter table public.longxin_backups enable row level security;
revoke all on public.longxin_backups from public, anon, authenticated;
grant select, insert on public.longxin_backups to authenticated;
grant all on public.longxin_backups to service_role;
create policy "Authors read own backups" on public.longxin_backups for select to authenticated
 using ((select auth.uid()) = user_id and exists (select 1 from public.longxin_authors where user_id = (select auth.uid())));
create policy "Authors create own backups" on public.longxin_backups for insert to authenticated
 with check ((select auth.uid()) = user_id and exists (select 1 from public.longxin_authors where user_id = (select auth.uid())));
comment on table public.longxin_backups is 'Private immutable author snapshots. No visitor access; no automatic publishing or overwrite.';

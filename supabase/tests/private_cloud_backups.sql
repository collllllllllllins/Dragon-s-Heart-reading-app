begin;
insert into public.longxin_backups(user_id,chapter_count,payload)
select user_id,0,'{"format":"longxin-backup-v1","chapters":[]}'::jsonb from public.longxin_authors limit 1;
select set_config('request.jwt.claim.sub',(select user_id::text from public.longxin_authors limit 1),true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.longxin_backups) < 1 then raise exception 'Author cannot read'; end if;
 insert into public.longxin_backups(user_id,chapter_count,payload) values (auth.uid(),0,'{"format":"longxin-backup-v1","chapters":[]}');
 begin
 update public.longxin_backups set chapter_count=0;
 raise exception 'Immutable snapshot updated';
 exception when insufficient_privilege then null; end;
 begin
 delete from public.longxin_backups;
 raise exception 'Snapshot deleted';
 exception when insufficient_privilege then null; end;
 begin
 insert into public.longxin_backups(user_id,chapter_count,payload) values ('11111111-1111-4111-8111-111111111111',0,'{"format":"longxin-backup-v1","chapters":[]}');
 raise exception 'Author can impersonate another owner';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.longxin_backups) <> 0 then raise exception 'Other account can read'; end if;
 begin
 insert into public.longxin_backups(user_id,chapter_count,payload) values (auth.uid(),0,'{"format":"longxin-backup-v1","chapters":[]}');
 raise exception 'Non-author can insert';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform 1 from public.longxin_backups; raise exception 'Anonymous can read'; exception when insufficient_privilege then null; end;
 begin insert into public.longxin_backups(user_id,chapter_count,payload) values ('11111111-1111-4111-8111-111111111111',0,'{"format":"longxin-backup-v1","chapters":[]}'); raise exception 'Anonymous can insert'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: author read/insert, owner isolation, visitor denial, immutable snapshots; fixtures rolled back' as result;

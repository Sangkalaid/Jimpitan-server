begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists ronda;
revoke all on schema ronda from public, anon, authenticated;

create table ronda.accounts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^62[0-9]{8,13}$' or phone ~ '^deleted-[0-9a-f-]{36}$'),
  name text not null check (length(name) between 3 and 120),
  pin_hash text not null,
  role text not null default 'warga' check (role in ('warga','pengurus','admin','master')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  avatar text,
  device_hash text,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create table ronda.sessions (
  token_hash text primary key,
  account_id uuid not null references ronda.accounts(id),
  device_hash text not null,
  expires_at timestamptz not null default now() + interval '7 days'
);
create table ronda.biometric_keys (
  account_id uuid primary key references ronda.accounts(id),
  token_hash text not null unique,
  device_hash text not null,
  expires_at timestamptz not null default now() + interval '90 days'
);
create table ronda.audit (
  id bigint generated always as identity primary key,
  account_id uuid references ronda.accounts(id),
  action text not null,
  created_at timestamptz not null default now()
);
create table ronda.pin_reset_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ronda.accounts(id),
  phone text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected','completed')),
  reset_token_hash text,
  reviewed_by uuid references ronda.accounts(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index pin_reset_one_pending on ronda.pin_reset_requests(account_id) where status='pending';
create index on ronda.pin_reset_requests(phone,created_at);

-- Old registrations remain archived; no plaintext PIN is copied into the new system.
insert into ronda.accounts(phone,name,pin_hash,role,status)
values ('6285877672699','Master Admin',extensions.crypt('123456',extensions.gen_salt('bf',12)),'master','approved');

create function ronda.profile(a ronda.accounts) returns jsonb
language sql stable set search_path = pg_catalog as $$
 select jsonb_build_object('id',a.id,'phone',a.phone,'name',a.name,'role',a.role,
 'status',a.status,'avatar',a.avatar,'created_at',a.created_at,'deleted_at',a.deleted_at)
$$;

create function public.ronda_auth(p_action text, p_data jsonb default '{}', p_token text default '')
returns jsonb language plpgsql security definer set search_path = pg_catalog, ronda, extensions as $$
declare
 a ronda.accounts; s ronda.sessions; v_phone text; v_device text; v_token text; v_reset ronda.pin_reset_requests;
 v_target ronda.accounts;
begin
 v_phone := regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g');
 if left(v_phone,1) = '0' then v_phone := '62' || substr(v_phone,2); end if;
 v_device := encode(extensions.digest(coalesce(p_data->>'device',''),'sha256'),'hex');
 if length(coalesce(p_data->>'device','')) < 32 then return jsonb_build_object('error','DEVICE'); end if;

 if p_action = 'register' then
   if v_phone !~ '^62[0-9]{8,13}$' or coalesce(p_data->>'pin','') !~ '^[0-9]{6}$'
      or length(trim(coalesce(p_data->>'name',''))) not between 3 and 120 then
     return jsonb_build_object('error','INPUT');
   end if;
   insert into ronda.accounts(phone,name,pin_hash)
   values(v_phone,trim(p_data->>'name'),extensions.crypt(p_data->>'pin',extensions.gen_salt('bf',12)))
   on conflict (phone) do nothing returning * into a;
   if a.id is null then return jsonb_build_object('error','EXISTS'); end if;
   return jsonb_build_object('status','pending');
 end if;

 if p_action in ('login','biometric_login') then
   if p_action = 'login' then
     select * into a from ronda.accounts where phone=v_phone and deleted_at is null for update;
     if a.id is null then return jsonb_build_object('error','UNREGISTERED'); end if;
     if a.locked_until > now() then return jsonb_build_object('error','LOCKED'); end if;
     if coalesce(p_data->>'pin','') !~ '^[0-9]{6}$' or
        extensions.crypt(p_data->>'pin',a.pin_hash) <> a.pin_hash then
       update ronda.accounts set failed_attempts=failed_attempts+1,
         locked_until=case when failed_attempts>=4 then now()+interval '15 minutes' else null end
         where id=a.id;
       return jsonb_build_object('error','PIN');
     end if;
     update ronda.accounts set failed_attempts=0,locked_until=null where id=a.id;
   else
     select ac.* into a from ronda.accounts ac join ronda.biometric_keys b on b.account_id=ac.id
       where b.token_hash=encode(extensions.digest(coalesce(p_data->>'credential',''),'sha256'),'hex')
       and b.device_hash=v_device and b.expires_at>now() and ac.deleted_at is null for update of ac;
     if a.id is null then return jsonb_build_object('error','SESSION'); end if;
   end if;
   if a.status <> 'approved' then return jsonb_build_object('error','PENDING'); end if;
   if a.device_hash is not null and a.device_hash<>v_device then
     if p_action <> 'login' or coalesce(p_data->>'replace_device','false')<>'true' then
       return jsonb_build_object('error','DEVICE_BOUND');
     end if;
     delete from ronda.sessions where account_id=a.id;
     delete from ronda.biometric_keys where account_id=a.id;
     insert into ronda.audit(account_id,action) values(a.id,'device_replaced');
   end if;
   update ronda.accounts set device_hash=v_device where id=a.id;
   delete from ronda.sessions where account_id=a.id;
   v_token := encode(extensions.gen_random_bytes(32),'hex');
   insert into ronda.sessions(token_hash,account_id,device_hash)
     values(encode(extensions.digest(v_token,'sha256'),'hex'),a.id,v_device);
   return jsonb_build_object('token',v_token,'account',ronda.profile(a));
 end if;

 if p_action='pin_reset_request' then
   select * into a from ronda.accounts where phone=v_phone and status='approved' and deleted_at is null;
   if a.id is null then return jsonb_build_object('error','UNREGISTERED'); end if;
   if exists(select 1 from ronda.pin_reset_requests where account_id=a.id and status='pending') then
     return jsonb_build_object('error','DUPLICATE');
   end if;
   if exists(select 1 from ronda.pin_reset_requests where account_id=a.id and created_at>now()-interval '3 minutes') then
     return jsonb_build_object('error','LOCKED');
   end if;
   insert into ronda.pin_reset_requests(account_id,phone) values(a.id,a.phone);
   return jsonb_build_object('status','pending');
 elsif p_action='pin_reset_complete' then
   select * into v_reset from ronda.pin_reset_requests
     where phone=v_phone and status='approved' and expires_at>now() for update;
   if v_reset.id is null or coalesce(p_data->>'pin','') !~ '^[0-9]{6}$' then return jsonb_build_object('error','INPUT'); end if;
   update ronda.accounts set pin_hash=extensions.crypt(p_data->>'pin',extensions.gen_salt('bf',12)),failed_attempts=0,locked_until=null
     where id=v_reset.account_id and status='approved' and deleted_at is null;
   update ronda.pin_reset_requests set status='completed' where id=v_reset.id;
   delete from ronda.sessions where account_id=v_reset.account_id;
   return jsonb_build_object('ok',true);
 end if;

 select * into s from ronda.sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
   and expires_at>now() and device_hash=v_device;
 select * into a from ronda.accounts where id=s.account_id and status='approved' and device_hash=v_device
   and deleted_at is null for update;
 if a.id is null then return jsonb_build_object('error','SESSION'); end if;
 if p_action='session' then return jsonb_build_object('account',ronda.profile(a));
 elsif p_action='logout' then
   delete from ronda.sessions where token_hash=s.token_hash;
 elsif p_action='biometric_enable' then
   v_token:=encode(extensions.gen_random_bytes(32),'hex');
   insert into ronda.biometric_keys(account_id,token_hash,device_hash)
     values(a.id,encode(extensions.digest(v_token,'sha256'),'hex'),v_device)
     on conflict(account_id) do update set token_hash=excluded.token_hash,device_hash=excluded.device_hash,
     expires_at=now()+interval '90 days';
   return jsonb_build_object('credential',v_token);
 elsif p_action='biometric_disable' then
   delete from ronda.biometric_keys where account_id=a.id;
 elsif p_action='pin_change_biometric' then
   if coalesce(p_data->>'credential','')='' or coalesce(p_data->>'pin','') !~ '^[0-9]{6}$' then return jsonb_build_object('error','INPUT'); end if;
   if not exists(select 1 from ronda.biometric_keys b where b.account_id=a.id
     and b.token_hash=encode(extensions.digest(p_data->>'credential','sha256'),'hex')
     and b.device_hash=v_device and b.expires_at>now()) then return jsonb_build_object('error','SESSION'); end if;
   update ronda.accounts set pin_hash=extensions.crypt(p_data->>'pin',extensions.gen_salt('bf',12)),failed_attempts=0,locked_until=null where id=a.id;
   delete from ronda.sessions where account_id=a.id;
   delete from ronda.biometric_keys where account_id=a.id;
 elsif p_action='avatar' then
   if length(coalesce(p_data->>'avatar',''))>300000 or
      coalesce(p_data->>'avatar','') !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then
     return jsonb_build_object('error','INPUT');
   end if;
   update ronda.accounts set avatar=p_data->>'avatar' where id=a.id returning * into a;
   return jsonb_build_object('account',ronda.profile(a));
 elsif p_action='accounts' then
   if a.role='warga' then return jsonb_build_object('error','FORBIDDEN'); end if;
   return jsonb_build_object('accounts',coalesce((select jsonb_agg(ronda.profile(x) order by x.created_at desc)
     from ronda.accounts x where x.deleted_at is null),'[]'::jsonb));
 elsif p_action='pin_reset_list' then
   if a.role='warga' then return jsonb_build_object('error','FORBIDDEN'); end if;
   return jsonb_build_object('requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'phone',r.phone,'status',r.status,'created_at',r.created_at,'name',x.name) order by r.created_at desc)
     from ronda.pin_reset_requests r join ronda.accounts x on x.id=r.account_id where r.status in ('pending','approved')),'[]'::jsonb));
 elsif p_action='pin_reset_review' then
   if a.role='warga' then return jsonb_build_object('error','FORBIDDEN'); end if;
   select * into v_reset from ronda.pin_reset_requests where id=(p_data->>'id')::uuid and status='pending' for update;
   if v_reset.id is null or p_data->>'status' not in ('approved','rejected') then return jsonb_build_object('error','INPUT'); end if;
   update ronda.pin_reset_requests set status=p_data->>'status',reviewed_by=a.id,reviewed_at=now(),
     reset_token_hash=null,
     expires_at=case when p_data->>'status'='approved' then now()+interval '30 minutes' else null end
     where id=v_reset.id;
   return jsonb_build_object('ok',true,'phone',v_reset.phone);
 elsif p_action in ('verify','role','account_delete') then
   if a.role='warga' or (p_action='role' and a.role<>'master') then
     return jsonb_build_object('error','FORBIDDEN');
   end if;
   select * into v_target from ronda.accounts where id=(p_data->>'id')::uuid for update;
   if v_target.id is null or v_target.role='master' or v_target.id=a.id then
     return jsonb_build_object('error','FORBIDDEN');
   end if;
   if p_action='verify' then
     if p_data->>'status' not in ('approved','rejected') then return jsonb_build_object('error','INPUT'); end if;
     update ronda.accounts set status=p_data->>'status' where id=v_target.id;
     delete from ronda.sessions where account_id=v_target.id;
   elsif p_action='role' then
     if v_target.status<>'approved' or p_data->>'role' not in ('warga','pengurus','admin') then
       return jsonb_build_object('error','INPUT');
     end if;
     update ronda.accounts set role=p_data->>'role' where id=v_target.id;
   else
     delete from ronda.sessions where account_id=v_target.id;
     delete from ronda.biometric_keys where account_id=v_target.id;
     delete from ronda.teams where account_id=v_target.id;
     update ronda.accounts set
       phone='deleted-'||v_target.id::text,
       name='Akun dihapus',
       role='warga',
       status='rejected',
       avatar=null,
       device_hash=null,
       failed_attempts=0,
       locked_until=null,
       deleted_at=now()
     where id=v_target.id;
   end if;
   insert into ronda.audit(account_id,action) values(a.id,p_action||':'||v_target.id::text);
 else return jsonb_build_object('error','INPUT');
 end if;
 return jsonb_build_object('ok',true);
end $$;

alter table ronda.accounts enable row level security;
alter table ronda.sessions enable row level security;
alter table ronda.biometric_keys enable row level security;
alter table ronda.audit enable row level security;
alter table ronda.pin_reset_requests enable row level security;
revoke all on all tables in schema ronda from public,anon,authenticated;
revoke all on all functions in schema ronda from public,anon,authenticated;
revoke all on function public.ronda_auth(text,jsonb,text) from public;
grant execute on function public.ronda_auth(text,jsonb,text) to anon,authenticated;

-- Disable access to legacy plaintext registrations without deleting the archive.
do $$ begin
 if to_regclass('public.residents') is not null then
   revoke all on public.residents from anon,authenticated;
   alter table public.residents enable row level security;
 end if;
end $$;
commit;

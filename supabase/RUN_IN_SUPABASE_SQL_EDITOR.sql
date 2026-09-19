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
begin;
create table ronda.points (
 id uuid primary key default gen_random_uuid(), legacy_id text unique, name text not null,
 description text not null default '', latitude double precision, longitude double precision,
 occupied boolean not null default true, deleted boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (latitude between -90 and 90), check (longitude between -180 and 180),
 check (length(name) between 1 and 120), check (length(description)<=1000)
);
create table ronda.checkins (
 id uuid primary key default gen_random_uuid(), point_id uuid not null references ronda.points(id),
 account_id uuid not null references ronda.accounts(id), day date not null,
 status text not null check(status in ('pasang','kosong')), amount integer not null check(amount>=0),
 latitude double precision not null, longitude double precision not null, accuracy double precision not null,
 created_at timestamptz not null default now(), unique(point_id,day)
);
create table ronda.teams (
 account_id uuid primary key references ronda.accounts(id), weekday integer not null check(weekday between 1 and 7)
);
create table ronda.requests (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references ronda.accounts(id),
 point_id uuid not null references ronda.points(id), amount integer not null check(amount>0),
 day date not null, status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references ronda.accounts(id), created_at timestamptz not null default now(),
 unique(account_id,point_id,day)
);
create table ronda.complaints (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references ronda.accounts(id),
 body text not null check(length(body) between 1 and 3000),
 status text not null default 'Menunggu' check(status in ('Menunggu','Diproses','Selesai')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table ronda.replies (
 id uuid primary key default gen_random_uuid(), complaint_id uuid not null references ronda.complaints(id),
 account_id uuid not null references ronda.accounts(id), body text not null check(length(body) between 1 and 3000),
 created_at timestamptz not null default now()
);
create table ronda.routes (
 id uuid primary key, account_id uuid not null references ronda.accounts(id),
 started_at timestamptz not null, ended_at timestamptz not null, path jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ended_at>=started_at), check(jsonb_typeof(path)='array'), check(jsonb_array_length(path) between 2 and 10000)
);
create table ronda.settings (
 singleton boolean primary key default true check(singleton), started_on date,
 legacy_org_id uuid, legacy_scope text not null default 'HSE-RT01-%',
 radius_m integer not null default 50 check(radius_m between 10 and 200),
 max_accuracy_m integer not null default 30 check(max_accuracy_m between 1 and 100),
 daily_amount integer not null default 500 check(daily_amount>0)
);
insert into ronda.settings(singleton) values(true);
create index on ronda.checkins(day);
create index on ronda.requests(day,status);
create index on ronda.complaints(account_id,created_at);
create index on ronda.replies(complaint_id,created_at);

-- Preserve the original RT01 house ID mapping. Never invent geographical coordinates.
do $$ begin
 if to_regclass('public.houses') is not null and exists(
   select 1 from information_schema.columns where table_schema='public' and table_name='houses' and column_name='house_id'
 ) then
   insert into ronda.points(id,legacy_id,name,description,occupied)
   select (j->>'id')::uuid,j->>'id',
     left(concat_ws(' ',nullif(j->>'house_id',''),nullif(j->>'house_no','')),120),
     left(coalesce(nullif(j->>'address',''),'Rumah RT01'),1000),
     coalesce((j->>'is_active')::boolean,true)
   from (select to_jsonb(h) j from public.houses h) src
   where coalesce(j->>'house_id','') like 'HSE-RT01-%' and (j->>'id') ~* '^[0-9a-f-]{36}$'
   on conflict(legacy_id) do update set
     name=excluded.name,description=excluded.description,occupied=excluded.occupied,updated_at=now();
   update ronda.settings s set legacy_org_id=(
     select (to_jsonb(h)->>'org_id')::uuid from public.houses h
     where to_jsonb(h)->>'house_id' like s.legacy_scope limit 1
   ) where s.legacy_org_id is null;
 end if;
end $$;

create function ronda.legacy_records(p_from date,p_to date)
returns table(day date,point_id uuid,amount integer,status text)
language plpgsql stable security definer set search_path=pg_catalog,ronda,public as $$
declare q text; has_ledger boolean; cfg ronda.settings;
begin
 select * into cfg from ronda.settings where singleton;
 if cfg.legacy_org_id is null then return; end if;
 has_ledger:=to_regclass('public.jimpitan_transactions') is not null
   and to_regclass('public.transaction_events') is not null
   and to_regclass('public.houses') is not null;
 if not has_ledger then return; end if;
 q:=$sql$
   select (t.server_timestamp at time zone 'Asia/Jakarta')::date as day,h.id as point_id,
     t.nominal::integer as amount,case when t.nominal>0 then 'pasang' else 'kosong' end as status
   from public.jimpitan_transactions t
   join public.transaction_events e on e.transaction_id=t.id and e.event_type='FINALIZED'
   join public.houses h on h.id=t.house_id and h.org_id=t.org_id
   where t.org_id=$1 and coalesce(h.house_id,'') like $2
     and (t.server_timestamp at time zone 'Asia/Jakarta')::date between $3 and $4
 $sql$;
 return query execute q using cfg.legacy_org_id,cfg.legacy_scope,p_from,p_to;
end $$;

create function ronda.snapshot(p_day date) returns jsonb language sql stable set search_path=pg_catalog,ronda as $$
 with day_records as (
   select point_id, amount, status from ronda.checkins where day=p_day
   union all select point_id, amount, 'pasang' from ronda.requests where day=p_day and status='approved'
   union all select point_id, amount, status from ronda.legacy_records(p_day,p_day)
 ), per_point as (
   select p.*,
     exists(select 1 from day_records d where d.point_id=p.id) as checked_today,
     coalesce((select case when sum(amount)>0 then 'pasang' when count(*)>0 then 'kosong' end from day_records d where d.point_id=p.id),'belum') as status_today,
     exists(select 1 from day_records d where d.point_id=p.id and d.amount>0) as paid
   from ronda.points p where not p.deleted
 )
 select coalesce(jsonb_agg(to_jsonb(per_point) order by created_at),'[]'::jsonb) from per_point
$$;
create function public.ronda_data(p_action text,p_data jsonb default '{}',p_token text default '')
returns jsonb language plpgsql security definer set search_path=pg_catalog,ronda,extensions as $$
declare
 a ronda.accounts; p ronda.points; req ronda.requests; cfg ronda.settings;
 v_device text; v_day date; v_id uuid; v_lat double precision; v_lng double precision;
 v_accuracy double precision; v_distance double precision; v_start date; v_end date;
 v_body text; v_admin boolean; v_result jsonb;
begin
 v_device:=encode(extensions.digest(coalesce(p_data->>'device',''),'sha256'),'hex');
 select ac.* into a from ronda.accounts ac join ronda.sessions s on s.account_id=ac.id
   where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now()
   and s.device_hash=v_device and ac.device_hash=v_device and ac.status='approved';
 if a.id is null then return jsonb_build_object('error','SESSION'); end if;
 v_admin:=a.role in ('master','pengurus','admin');
 select * into cfg from ronda.settings where singleton;
 v_day:=coalesce((p_data->>'day')::date,(now() at time zone 'Asia/Jakarta')::date);

 if p_action='dashboard' then
   return jsonb_build_object('points',ronda.snapshot(v_day),'settings',to_jsonb(cfg),
     'total',coalesce((select sum(amount) from ronda.checkins where day=v_day),0)+
       coalesce((select sum(amount) from ronda.requests where day=v_day and status='approved'),0)+
       coalesce((select sum(amount) from ronda.legacy_records(v_day,v_day)),0));
 elsif p_action='point_save' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   v_lat:=(p_data->>'latitude')::double precision; v_lng:=(p_data->>'longitude')::double precision;
   if v_lat is null or v_lng is null or not(v_lat between -90 and 90) or not(v_lng between -180 and 180)
      or length(trim(coalesce(p_data->>'name',''))) not between 1 and 120 then return jsonb_build_object('error','INPUT'); end if;
   if p_data->>'id' is null then
     insert into ronda.points(name,description,latitude,longitude) values(trim(p_data->>'name'),coalesce(p_data->>'description',''),v_lat,v_lng);
   else
     update ronda.points set name=trim(p_data->>'name'),description=coalesce(p_data->>'description',''),
       latitude=v_lat,longitude=v_lng,updated_at=now() where id=(p_data->>'id')::uuid and not deleted;
   end if;
 elsif p_action='point_delete' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   update ronda.points set deleted=true,updated_at=now() where id=(p_data->>'id')::uuid;
 elsif p_action='checkin' then
   if abs(v_day-(now() at time zone 'Asia/Jakarta')::date)>1 then return jsonb_build_object('error','INPUT'); end if;
   if not v_admin and not exists(select 1 from ronda.teams where account_id=a.id and weekday=extract(isodow from v_day)) then
     return jsonb_build_object('error','FORBIDDEN');
   end if;
   select * into p from ronda.points where id=(p_data->>'point_id')::uuid and not deleted for update;
   if p.id is null or p.latitude is null or p.longitude is null then return jsonb_build_object('error','MAP_POINT'); end if;
   v_lat:=(p_data->>'latitude')::double precision; v_lng:=(p_data->>'longitude')::double precision;
   v_accuracy:=(p_data->>'accuracy')::double precision;
   if v_accuracy is null or not(v_accuracy between 0 and cfg.max_accuracy_m) then return jsonb_build_object('error','ACCURACY'); end if;
   if v_lat is null or v_lng is null or not(v_lat between -90 and 90) or not(v_lng between -180 and 180) then return jsonb_build_object('error','INPUT'); end if;
   v_distance:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(p.latitude-v_lat)/2),2)+
     cos(radians(v_lat))*cos(radians(p.latitude))*power(sin(radians(p.longitude-v_lng)/2),2))));
   if v_distance+v_accuracy>cfg.radius_m then return jsonb_build_object('error','DISTANCE'); end if;
   if p_data->>'status' not in ('pasang','kosong') then return jsonb_build_object('error','INPUT'); end if;
   if exists(select 1 from ronda.requests where point_id=p.id and day=v_day and status='approved') then
     return jsonb_build_object('error','DUPLICATE');
   end if;
   insert into ronda.checkins(point_id,account_id,day,status,amount,latitude,longitude,accuracy)
     values(p.id,a.id,v_day,p_data->>'status',case when p_data->>'status'='pasang' then cfg.daily_amount else 0 end,v_lat,v_lng,v_accuracy)
     on conflict(point_id,day) do nothing returning id into v_id;
   if v_id is null then return jsonb_build_object('error','DUPLICATE'); end if;
   update ronda.points set occupied=p_data->>'status'='pasang',updated_at=now() where id=p.id;
   update ronda.settings set started_on=least(coalesce(started_on,v_day),v_day) where singleton;
 elsif p_action='checkin_cancel' then
   if abs(v_day-(now() at time zone 'Asia/Jakarta')::date)>1 then return jsonb_build_object('error','INPUT'); end if;
   if not v_admin and not exists(select 1 from ronda.teams where account_id=a.id and weekday=extract(isodow from v_day)) then
     return jsonb_build_object('error','FORBIDDEN');
   end if;
   select * into p from ronda.points where id=(p_data->>'point_id')::uuid and not deleted for update;
   if p.id is null then return jsonb_build_object('error','MAP_POINT'); end if;
   delete from ronda.checkins where point_id=p.id and day=v_day returning id into v_id;
   if v_id is null then return jsonb_build_object('error','INPUT'); end if;
   update ronda.points set occupied=false,updated_at=now() where id=p.id and not exists(
     select 1 from ronda.checkins c where c.point_id=p.id and c.status='pasang'
   );
 elsif p_action='teams' then
   return jsonb_build_object('teams',coalesce((select jsonb_agg(jsonb_build_object('id',ac.id,'name',ac.name,'weekday',t.weekday) order by t.weekday,ac.name)
     from ronda.teams t join ronda.accounts ac on ac.id=t.account_id where ac.status='approved' and
     (v_admin or t.weekday=(select weekday from ronda.teams where account_id=a.id))),'[]'::jsonb));
 elsif p_action='team_save' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   if not exists(select 1 from ronda.accounts where id=(p_data->>'id')::uuid and status='approved') then return jsonb_build_object('error','INPUT'); end if;
   if p_data->>'weekday' is null then delete from ronda.teams where account_id=(p_data->>'id')::uuid;
   else insert into ronda.teams(account_id,weekday) values((p_data->>'id')::uuid,(p_data->>'weekday')::integer)
     on conflict(account_id) do update set weekday=excluded.weekday;
   end if;
 elsif p_action='request_create' then
   if abs(v_day-(now() at time zone 'Asia/Jakarta')::date)>1 then return jsonb_build_object('error','INPUT'); end if;
   if not exists(select 1 from ronda.points where id=(p_data->>'point_id')::uuid and not deleted and occupied) then return jsonb_build_object('error','INPUT'); end if;
   insert into ronda.requests(account_id,point_id,day,amount) values(a.id,(p_data->>'point_id')::uuid,v_day,(p_data->>'amount')::integer)
     on conflict(account_id,point_id,day) do nothing returning id into v_id;
   if v_id is null then return jsonb_build_object('error','DUPLICATE'); end if;
 elsif p_action='requests' then
   return jsonb_build_object('requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('name',ac.name,'point_name',pt.name) order by r.created_at desc)
     from ronda.requests r join ronda.accounts ac on ac.id=r.account_id join ronda.points pt on pt.id=r.point_id
     where v_admin or r.account_id=a.id),'[]'::jsonb));
 elsif p_action='request_review' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   select * into req from ronda.requests where id=(p_data->>'id')::uuid for update;
   if req.id is null or req.status<>'pending' or p_data->>'status' not in ('approved','rejected') then return jsonb_build_object('error','INPUT'); end if;
   select * into p from ronda.points where id=req.point_id for update;
   if p_data->>'status'='approved' then
     if not p.occupied or p.deleted then return jsonb_build_object('error','INPUT'); end if;
     if exists(select 1 from ronda.checkins where point_id=p.id and day=req.day and amount>0) or
        exists(select 1 from ronda.requests where point_id=p.id and day=req.day and status='approved') then
       return jsonb_build_object('error','DUPLICATE');
     end if;
     update ronda.settings set started_on=least(coalesce(started_on,req.day),req.day) where singleton;
   end if;
   update ronda.requests set status=p_data->>'status',reviewed_by=a.id where id=req.id;
 elsif p_action='report' then
   v_start:=case p_data->>'period' when 'minggu' then v_day-(extract(isodow from v_day)::int-1)
     when 'bulan' then date_trunc('month',v_day)::date else v_day end;
   v_end:=case p_data->>'period' when 'minggu' then v_start+6
     when 'bulan' then (v_start+interval '1 month'-interval '1 day')::date else v_day end;
   v_start:=greatest(v_start,coalesce(cfg.started_on,v_start));
   select jsonb_build_object('amount',coalesce(sum(amount),0),'transactions',count(*),
     'pasang',count(distinct point_id) filter(where amount>0),'kosong',count(distinct point_id) filter(where status='kosong'),
     'belum',greatest(0,(select count(*) from ronda.points where not deleted)-count(distinct point_id))) into v_result
     from (select point_id,amount,status from ronda.checkins where day between v_start and least(v_day,v_end)
       union all select point_id,amount,'pasang' from ronda.requests where status='approved' and day between v_start and least(v_day,v_end)
       union all select point_id,amount,status from ronda.legacy_records(v_start,least(v_day,v_end))) final_records;
   return v_result||jsonb_build_object('start',v_start,'end',v_end,'through',least(v_day,v_end),'complete',v_day>v_end,'started',cfg.started_on is not null);
 elsif p_action='complaint_create' then
   v_body:=trim(coalesce(p_data->>'body',''));
   if length(v_body) not between 1 and 3000 then return jsonb_build_object('error','INPUT'); end if;
   insert into ronda.complaints(account_id,body) values(a.id,v_body);
 elsif p_action='complaints' then
   return jsonb_build_object('complaints',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('name',ac.name,
     'replies',coalesce((select jsonb_agg(jsonb_build_object('body',r.body,'created_at',r.created_at) order by r.created_at)
       from ronda.replies r where r.complaint_id=c.id),'[]'::jsonb)) order by c.created_at desc)
     from ronda.complaints c join ronda.accounts ac on ac.id=c.account_id where v_admin or c.account_id=a.id),'[]'::jsonb));
 elsif p_action='complaint_reply' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   if p_data->>'status' not in ('Menunggu','Diproses','Selesai') then return jsonb_build_object('error','INPUT'); end if;
   v_body:=trim(coalesce(p_data->>'body',''));
   if length(v_body)>3000 then return jsonb_build_object('error','INPUT'); end if;
   update ronda.complaints set status=p_data->>'status',updated_at=now() where id=(p_data->>'id')::uuid;
   if v_body<>'' then insert into ronda.replies(complaint_id,account_id,body) values((p_data->>'id')::uuid,a.id,v_body); end if;
 elsif p_action='route_save' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   if jsonb_typeof(p_data->'path')<>'array' or jsonb_array_length(p_data->'path') not between 2 and 10000 then return jsonb_build_object('error','INPUT'); end if;
   if exists(select 1 from jsonb_array_elements(p_data->'path') t where
     not coalesce((t->>'lat')::double precision between -90 and 90,false) or
     not coalesce((t->>'lng')::double precision between -180 and 180,false) or
     not coalesce((t->>'accuracy')::double precision between 0 and cfg.max_accuracy_m,false)) then return jsonb_build_object('error','INPUT'); end if;
   insert into ronda.routes(id,account_id,started_at,ended_at,path)
     values((p_data->>'id')::uuid,a.id,(p_data->>'started_at')::timestamptz,(p_data->>'ended_at')::timestamptz,p_data->'path')
     on conflict(id) do nothing;
 elsif p_action='routes' then
   if not v_admin then return jsonb_build_object('error','FORBIDDEN'); end if;
   return jsonb_build_object('routes',coalesce((select jsonb_agg(to_jsonb(r)) from
     (select * from ronda.routes order by started_at desc limit 30) r),'[]'::jsonb));
 else return jsonb_build_object('error','INPUT');
 end if;
 insert into ronda.audit(account_id,action) values(a.id,p_action);
 return jsonb_build_object('ok',true);
end $$;

do $$ declare t text; begin
 foreach t in array array['points','checkins','teams','requests','complaints','replies','routes','settings'] loop
   execute format('alter table ronda.%I enable row level security',t);
 end loop;
end $$;
revoke all on all tables in schema ronda from public,anon,authenticated;
revoke all on all functions in schema ronda from public,anon,authenticated;
revoke all on function public.ronda_data(text,jsonb,text) from public;
grant execute on function public.ronda_data(text,jsonb,text) to anon,authenticated;
commit;

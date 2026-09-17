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
 radius_m integer not null default 50 check(radius_m between 10 and 200),
 max_accuracy_m integer not null default 30 check(max_accuracy_m between 1 and 100),
 daily_amount integer not null default 500 check(daily_amount>0)
);
insert into ronda.settings(singleton) values(true);
create index on ronda.checkins(day);
create index on ronda.requests(day,status);
create index on ronda.complaints(account_id,created_at);
create index on ronda.replies(complaint_id,created_at);

-- Preserve the original house ID mapping. Never invent geographical coordinates.
do $$ begin
 if to_regclass('public.houses') is not null then
   insert into ronda.points(legacy_id,name,description,occupied)
   select j->>'id',left(coalesce(nullif(j->>'nama_warga',''),nullif(j->>'name',''),'Rumah'),120),
     concat_ws(' / ',j->>'no_rumah',j->>'gang'),coalesce(j->>'status_jimpitan','pasang')<>'kosong'
   from (select to_jsonb(h) j from public.houses h) src on conflict(legacy_id) do nothing;
   revoke all on public.houses from anon,authenticated;
 end if;
 if to_regclass('public.jimpitan_transactions') is not null then
   revoke all on public.jimpitan_transactions from anon,authenticated;
 end if;
end $$;

create function ronda.snapshot(p_day date) returns jsonb language sql stable set search_path=pg_catalog,ronda as $$
 select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('paid',p.occupied and
   (exists(select 1 from ronda.checkins c where c.point_id=p.id and c.day=p_day and c.status='pasang') or
    exists(select 1 from ronda.requests r where r.point_id=p.id and r.day=p_day and r.status='approved')))
   order by p.created_at),'[]'::jsonb) from ronda.points p where not p.deleted
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
       coalesce((select sum(amount) from ronda.requests where day=v_day and status='approved'),0));
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
     'pasang',count(distinct point_id) filter(where amount>0),'kosong',count(distinct point_id) filter(where status='kosong')) into v_result
     from (select point_id,amount,status from ronda.checkins where day between v_start and least(v_day,v_end)
       union all select point_id,amount,'pasang' from ronda.requests where status='approved' and day between v_start and least(v_day,v_end)) final_records;
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

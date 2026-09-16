-- Read-only checks after 202609160002_harden_rpc_permissions.sql.
-- Expected: rpc_count=6, anonymous_blocked=true, authenticated_allowed=true.
select count(*) as rpc_count,
       bool_and(not has_function_privilege('anon', p.oid, 'EXECUTE')) as anonymous_blocked,
       bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')) as authenticated_allowed
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_auth_user_claims', 'create_collection_transaction',
    'void_collection_transaction', 'finalize_patrol_session',
    'create_reversal_transaction', 'create_adjustment_transaction'
  );

-- Expected: 0.00, approximately 111194.93 meters, true.
select public.calculate_haversine_distance_meters(0,0,0,0) as zero_distance,
       public.calculate_haversine_distance_meters(0,0,0,1) as one_degree_meters,
       public.calculate_haversine_distance_meters(91,0,0,0) is null as invalid_rejected;

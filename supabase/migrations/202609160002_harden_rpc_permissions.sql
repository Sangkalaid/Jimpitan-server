-- Restrict application RPCs to signed-in users. Preserve their internal
-- role/organization checks and SECURITY DEFINER execution for ledger writes.
begin;

alter function public.calculate_haversine_distance_meters(numeric,numeric,numeric,numeric)
  set search_path = pg_catalog;

revoke execute on function public.get_auth_user_claims() from public, anon;
revoke execute on function public.create_collection_transaction(uuid,character varying,uuid,uuid,public.collection_status_enum,integer,timestamp with time zone,numeric,numeric,numeric) from public, anon;
revoke execute on function public.void_collection_transaction(uuid,text) from public, anon;
revoke execute on function public.finalize_patrol_session(uuid,text) from public, anon;
revoke execute on function public.create_reversal_transaction(uuid,uuid,uuid,text) from public, anon;
revoke execute on function public.create_adjustment_transaction(uuid,uuid,uuid,integer,text) from public, anon;

grant execute on function public.get_auth_user_claims() to authenticated;
grant execute on function public.create_collection_transaction(uuid,character varying,uuid,uuid,public.collection_status_enum,integer,timestamp with time zone,numeric,numeric,numeric) to authenticated;
grant execute on function public.void_collection_transaction(uuid,text) to authenticated;
grant execute on function public.finalize_patrol_session(uuid,text) to authenticated;
grant execute on function public.create_reversal_transaction(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.create_adjustment_transaction(uuid,uuid,uuid,integer,text) to authenticated;

commit;

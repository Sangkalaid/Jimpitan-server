-- Ensure the three reporting views execute with the caller's permissions.
-- This makes the underlying Row Level Security policies apply to every query.
begin;

alter view public.view_official_cash_ledger
  set (security_invoker = true);

alter view public.view_operational_session_progress
  set (security_invoker = true);

alter view public.view_active_session_houses
  set (security_invoker = true);

revoke all on public.view_official_cash_ledger from public, anon;
revoke all on public.view_operational_session_progress from public, anon;
revoke all on public.view_active_session_houses from public, anon;

grant select on public.view_official_cash_ledger to authenticated;
grant select on public.view_operational_session_progress to authenticated;
grant select on public.view_active_session_houses to authenticated;

commit;

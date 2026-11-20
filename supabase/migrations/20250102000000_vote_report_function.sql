-- Record or change the caller's vote on a report.
--
-- PostgREST's upsert (`on_conflict=...`) rewrites every supplied column on
-- conflict, including report_id and user_id, which users are deliberately not
-- allowed to update. This function only ever updates confirmation_type.
-- It runs with the caller's privileges, so RLS and the confirmation triggers
-- (no votes on own or inactive reports) still apply.
create or replace function public.vote_report(p_report_id uuid, p_type text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.report_confirmations (report_id, user_id, confirmation_type)
  values (p_report_id, auth.uid(), p_type)
  on conflict (report_id, user_id) do update set confirmation_type = excluded.confirmation_type;
$$;

revoke execute on function public.vote_report(uuid, text) from public, anon;
grant execute on function public.vote_report(uuid, text) to authenticated;

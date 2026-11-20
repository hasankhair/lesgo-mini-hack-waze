-- Lesgo initial schema
-- Tables: profiles, traffic_reports, report_confirmations, saved_locations, navigation_history
-- Every table has Row Level Security enabled and explicit, minimal grants.

------------------------------------------------------------------------------
-- Helpers
------------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

------------------------------------------------------------------------------
-- profiles
------------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
               check (char_length(username) between 3 and 30 and username ~ '^[A-Za-z0-9_.-]+$'),
  email        text check (email is null or char_length(email) <= 320),
  avatar_url   text check (avatar_url is null or (char_length(avatar_url) <= 500 and avatar_url ~ '^https://')),
  save_history boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column public.profiles.save_history is
  'When false, the API does not record navigation history for this user.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  candidate text;
  attempt integer := 0;
begin
  if requested is not null
     and char_length(requested) between 3 and 30
     and requested ~ '^[A-Za-z0-9_.-]+$'
     and not exists (select 1 from public.profiles where username = requested) then
    candidate := requested;
  else
    -- Generated, collision-checked fallback such as "driver_3f9a0c1b2d4e".
    loop
      candidate := 'driver_' || substr(md5(new.id::text || attempt::text), 1, 12);
      exit when not exists (select 1 from public.profiles where username = candidate);
      attempt := attempt + 1;
    end loop;
  end if;

  insert into public.profiles (id, username, email)
  values (new.id, candidate, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- traffic_reports
------------------------------------------------------------------------------

create table public.traffic_reports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  reporter_username  text,
  report_type        text not null check (report_type in (
                       'accident', 'traffic_jam', 'roadblock', 'police', 'construction',
                       'flood', 'hazard', 'breakdown', 'other')),
  description        text check (description is null or char_length(description) <= 280),
  latitude           double precision not null check (latitude between -90 and 90),
  longitude          double precision not null check (longitude between -180 and 180),
  status             text not null default 'active'
                     check (status in ('active', 'cleared', 'expired', 'removed')),
  confirmation_count integer not null default 0 check (confirmation_count >= 0),
  not_present_count  integer not null default 0 check (not_present_count >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  constraint traffic_reports_expiry_after_creation check (expires_at > created_at)
);

create index traffic_reports_active_idx on public.traffic_reports (status, expires_at);
create index traffic_reports_location_idx on public.traffic_reports (latitude, longitude);
create index traffic_reports_user_idx on public.traffic_reports (user_id, created_at desc);

-- Lifetime of a fresh report, by category.
create or replace function public.report_lifetime(p_type text)
returns interval
language sql
immutable
as $$
  select case p_type
    when 'traffic_jam'  then interval '45 minutes'
    when 'police'       then interval '60 minutes'
    when 'accident'     then interval '90 minutes'
    when 'breakdown'    then interval '60 minutes'
    when 'hazard'       then interval '2 hours'
    when 'roadblock'    then interval '4 hours'
    when 'flood'        then interval '6 hours'
    when 'construction' then interval '12 hours'
    else interval '60 minutes'
  end;
$$;

-- Server-controlled fields, rate limiting and duplicate detection on insert.
-- These run in the database so they also apply to clients that call the
-- Supabase REST API directly with the public anon key.
create or replace function public.traffic_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  new.status := 'active';
  new.confirmation_count := 0;
  new.not_present_count := 0;
  new.created_at := now();
  new.updated_at := now();
  new.expires_at := now() + public.report_lifetime(new.report_type);
  new.description := nullif(trim(new.description), '');
  select username into new.reporter_username from public.profiles where id = new.user_id;

  select count(*) into recent_count
  from public.traffic_reports
  where user_id = new.user_id and created_at > now() - interval '10 minutes';

  if recent_count >= 10 then
    raise exception 'You have submitted too many reports. Please wait a few minutes.'
      using errcode = 'RP429', hint = 'RATE_LIMITED';
  end if;

  -- Same user, same category, within roughly 100 m, in the last 15 minutes.
  if exists (
    select 1 from public.traffic_reports
    where user_id = new.user_id
      and report_type = new.report_type
      and status = 'active'
      and created_at > now() - interval '15 minutes'
      and abs(latitude - new.latitude) < 0.0009
      and abs(longitude - new.longitude) < 0.0009 / greatest(cos(radians(new.latitude)), 0.01)
  ) then
    raise exception 'You already reported this incident nearby.'
      using errcode = 'RP409', hint = 'DUPLICATE_REPORT';
  end if;

  return new;
end;
$$;

create trigger traffic_reports_before_insert
  before insert on public.traffic_reports
  for each row execute function public.traffic_reports_before_insert();

create trigger traffic_reports_set_updated_at
  before update on public.traffic_reports
  for each row execute function public.set_updated_at();

-- Owners may only withdraw their own active report (status -> 'removed').
create or replace function public.traffic_reports_guard_owner_update()
returns trigger
language plpgsql
as $$
begin
  -- Internal updates (triggers owned by the table owner) are not restricted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if old.status <> 'active' or new.status <> 'removed' then
    raise exception 'Only active reports can be withdrawn.'
      using errcode = 'RP422', hint = 'INVALID_STATUS_CHANGE';
  end if;
  return new;
end;
$$;

create trigger traffic_reports_guard_owner_update
  before update on public.traffic_reports
  for each row execute function public.traffic_reports_guard_owner_update();

-- Mark reports whose expiry has passed. Schedule with pg_cron if desired:
--   select cron.schedule('expire-reports', '*/5 * * * *', 'select public.expire_stale_reports()');
-- Queries and RLS already hide expired rows, so this is housekeeping only.
create or replace function public.expire_stale_reports()
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.traffic_reports
    set status = 'expired'
    where status = 'active' and expires_at <= now()
    returning 1
  )
  select count(*)::integer from updated;
$$;

-- The caller's own reports, any status (dashboard history).
create or replace function public.my_traffic_reports(p_limit integer default 50)
returns table (
  id uuid, report_type text, description text, latitude double precision, longitude double precision,
  status text, confirmation_count integer, not_present_count integer,
  created_at timestamptz, expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select id, report_type, description, latitude, longitude, status,
         confirmation_count, not_present_count, created_at, expires_at
  from public.traffic_reports
  where user_id = auth.uid()
  order by created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- Which of the given report ids belong to the caller.
create or replace function public.owned_report_ids(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.traffic_reports
  where user_id = auth.uid() and id = any(p_ids[1:500]);
$$;

------------------------------------------------------------------------------
-- report_confirmations
------------------------------------------------------------------------------

create table public.report_confirmations (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid not null references public.traffic_reports (id) on delete cascade,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  confirmation_type text not null check (confirmation_type in ('confirm', 'not_present')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint report_confirmations_one_per_user unique (report_id, user_id)
);

create index report_confirmations_user_idx on public.report_confirmations (user_id);

create trigger report_confirmations_set_updated_at
  before update on public.report_confirmations
  for each row execute function public.set_updated_at();

create or replace function public.report_confirmations_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.traffic_reports%rowtype;
begin
  select * into r from public.traffic_reports where id = new.report_id;
  if not found or r.status <> 'active' or r.expires_at <= now() then
    raise exception 'This report is no longer active.'
      using errcode = 'RP410', hint = 'REPORT_NOT_ACTIVE';
  end if;
  if r.user_id = new.user_id then
    raise exception 'You cannot vote on your own report.'
      using errcode = 'RP403', hint = 'OWN_REPORT';
  end if;
  return new;
end;
$$;

create trigger report_confirmations_before_write
  before insert or update on public.report_confirmations
  for each row execute function public.report_confirmations_before_write();

-- Keep counts, expiry and status on traffic_reports in sync with votes.
create or replace function public.report_confirmations_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.report_id, old.report_id);
  confirms integer;
  absents integer;
begin
  select count(*) filter (where confirmation_type = 'confirm'),
         count(*) filter (where confirmation_type = 'not_present')
    into confirms, absents
  from public.report_confirmations
  where report_id = target;

  update public.traffic_reports t
  set confirmation_count = confirms,
      not_present_count = absents,
      -- A fresh confirmation keeps the report alive, capped at 3x its base lifetime.
      expires_at = case
        when tg_op <> 'DELETE' and new.confirmation_type = 'confirm' then
          least(greatest(t.expires_at, now() + public.report_lifetime(t.report_type) / 2),
                t.created_at + public.report_lifetime(t.report_type) * 3)
        else t.expires_at
      end,
      status = case
        when t.status = 'active' and absents >= 3 and absents > confirms then 'cleared'
        else t.status
      end
  where t.id = target;

  return null;
end;
$$;

create trigger report_confirmations_after_write
  after insert or update or delete on public.report_confirmations
  for each row execute function public.report_confirmations_after_write();

------------------------------------------------------------------------------
-- saved_locations
------------------------------------------------------------------------------

create table public.saved_locations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  location_name text not null check (char_length(trim(location_name)) between 1 and 80),
  category      text not null default 'favorite' check (category in ('home', 'work', 'favorite')),
  address       text check (address is null or char_length(address) <= 300),
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  created_at    timestamptz not null default now()
);

create index saved_locations_user_idx on public.saved_locations (user_id, created_at desc);
-- At most one Home and one Work entry per user.
create unique index saved_locations_single_home_work
  on public.saved_locations (user_id, category)
  where category in ('home', 'work');

------------------------------------------------------------------------------
-- navigation_history
------------------------------------------------------------------------------

create table public.navigation_history (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references public.profiles (id) on delete cascade,
  origin_label               text check (origin_label is null or char_length(origin_label) <= 300),
  origin_latitude            double precision check (origin_latitude between -90 and 90),
  origin_longitude           double precision check (origin_longitude between -180 and 180),
  destination_label          text not null check (char_length(destination_label) between 1 and 300),
  destination_latitude       double precision not null check (destination_latitude between -90 and 90),
  destination_longitude      double precision not null check (destination_longitude between -180 and 180),
  distance_meters            double precision not null check (distance_meters >= 0),
  estimated_duration_seconds double precision not null check (estimated_duration_seconds >= 0),
  created_at                 timestamptz not null default now()
);

create index navigation_history_user_idx on public.navigation_history (user_id, created_at desc);

------------------------------------------------------------------------------
-- Grants (least privilege). Supabase grants broad defaults; reset them here.
------------------------------------------------------------------------------

revoke all on public.profiles, public.traffic_reports, public.report_confirmations,
              public.saved_locations, public.navigation_history
  from anon, authenticated;

-- user_id is deliberately not readable, so a reporter's account cannot be
-- linked to their report locations via the API or Realtime payloads.
grant select (id, reporter_username, report_type, description, latitude, longitude, status,
              confirmation_count, not_present_count, created_at, updated_at, expires_at)
  on public.traffic_reports to anon, authenticated;
grant insert (user_id, report_type, description, latitude, longitude) on public.traffic_reports to authenticated;
grant update (status) on public.traffic_reports to authenticated;

grant select, update (username, avatar_url, save_history) on public.profiles to authenticated;

grant select, delete on public.report_confirmations to authenticated;
grant insert (report_id, user_id, confirmation_type),
      update (confirmation_type) on public.report_confirmations to authenticated;

grant select, delete on public.saved_locations to authenticated;
grant insert (user_id, location_name, category, address, latitude, longitude),
      update (location_name, category, address, latitude, longitude) on public.saved_locations to authenticated;

grant select, delete on public.navigation_history to authenticated;
grant insert (user_id, origin_label, origin_latitude, origin_longitude, destination_label,
              destination_latitude, destination_longitude, distance_meters, estimated_duration_seconds)
  on public.navigation_history to authenticated;

revoke execute on function public.expire_stale_reports() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.my_traffic_reports(integer) from public, anon;
revoke execute on function public.owned_report_ids(uuid[]) from public, anon;
grant execute on function public.my_traffic_reports(integer) to authenticated;
grant execute on function public.owned_report_ids(uuid[]) to authenticated;

------------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------------

alter table public.profiles             enable row level security;
alter table public.traffic_reports      enable row level security;
alter table public.report_confirmations enable row level security;
alter table public.saved_locations      enable row level security;
alter table public.navigation_history   enable row level security;

-- profiles: a user sees and edits only their own profile (email stays private).
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- traffic_reports: anyone may read recent reports. Rows stay readable for an
-- hour past expiry so Realtime can deliver status changes (e.g. 'cleared') to
-- subscribers; clients and the API only display active, unexpired rows.
create policy "reports_select_recent" on public.traffic_reports
  for select to anon, authenticated
  using (expires_at > now() - interval '1 hour');
create policy "reports_select_own" on public.traffic_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "reports_insert_own" on public.traffic_reports
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "reports_update_own" on public.traffic_reports
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- report_confirmations: users manage only their own votes.
create policy "confirmations_select_own" on public.report_confirmations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "confirmations_insert_own" on public.report_confirmations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "confirmations_update_own" on public.report_confirmations
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "confirmations_delete_own" on public.report_confirmations
  for delete to authenticated using (user_id = (select auth.uid()));

-- saved_locations and navigation_history: private to their owner.
create policy "saved_locations_owner" on public.saved_locations
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "navigation_history_owner" on public.navigation_history
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

------------------------------------------------------------------------------
-- Realtime
------------------------------------------------------------------------------

alter publication supabase_realtime add table public.traffic_reports;

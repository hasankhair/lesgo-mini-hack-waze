-- Minimal stand-in for the parts of Supabase the migration depends on, so the
-- schema and RLS policies can be tested with an in-process Postgres (PGlite).
-- auth.uid() mirrors Supabase's implementation by reading the JWT subject claim.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

create publication supabase_realtime;

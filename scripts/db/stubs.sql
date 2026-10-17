-- Stand-ins for the parts of Supabase that the migrations lean on, so the database can be built and
-- tested on a plain PostgreSQL with no Docker. This is NOT a copy of Supabase: it only provides
-- roles, auth.uid(), a minimal auth.users and storage, and the default grants. The real check is
-- `supabase db reset` and `supabase test db` (see .github/workflows/ci.yml).
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role supabase_auth_admin nologin;

create schema auth;
create schema extensions;
create schema storage;

create table auth.users (
  id uuid primary key, email text, aud text, role text,
  email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table storage.buckets (
  id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as
  $$ declare _parts text[]; begin select string_to_array(name, '/') into _parts;
     return _parts[1:array_length(_parts, 1) - 1]; end $$;

grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema auth, storage to anon, authenticated, service_role;

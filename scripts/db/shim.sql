-- A minimal stand-in for the pgTAP functions the test files use (plan, ok, is, lives_ok, throws_ok),
-- recording results in a table. Real pgTAP runs in CI via `supabase test db`.
create schema shim;
grant usage on schema shim to public;
create table shim.results (n int generated always as identity, ok bool, d text);
grant all on shim.results to public;

create function plan(int) returns text language sql as $$ select ''::text $$;
create function ok(bool, text default '') returns text language plpgsql as $$
  begin insert into shim.results(ok, d) values (coalesce($1, false), $2); return ''; end $$;
create function is(anyelement, anyelement, text default '') returns text language plpgsql as $$
  begin
    insert into shim.results(ok, d) values ($1 is not distinct from $2,
      $3 || case when $1 is not distinct from $2 then '' else ' :: got ' || coalesce($1::text, 'NULL') || ' expected ' || coalesce($2::text, 'NULL') end);
    return '';
  end $$;
create function lives_ok(text, text default '') returns text language plpgsql as $$
  begin execute $1; insert into shim.results(ok, d) values (true, $2); return '';
  exception when others then insert into shim.results(ok, d) values (false, $2 || ' :: ' || sqlerrm); return ''; end $$;
create function throws_ok(text, text, text, text default '') returns text language plpgsql as $$
  begin execute $1; insert into shim.results(ok, d) values (false, $4 || ' :: did not throw'); return '';
  exception when others then
    insert into shim.results(ok, d) values ((sqlstate = $2 or $2 is null) and ($3 is null or sqlerrm = $3), $4 || ' :: ' || sqlstate || ' ' || sqlerrm);
    return ''; end $$;

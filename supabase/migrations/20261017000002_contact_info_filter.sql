-- BUILD.md 5.6: the contact-info filter. It comes before the tables because check
-- constraints on trips and ride_requests call it. It touches no tables, so it can be
-- immutable, and an empty search_path keeps it out of the "mutable search_path" advisor warning.
create or replace function contains_contact_info(t text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
       t ~* '(\+?\d[\d\-\s().]{8,}\d)'
    or t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    or t ~* '(^|\s)@[a-z0-9_.]{2,}'
    or t ~* '(https?://|www\.)'
    or t ~* '\m[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|app|dev)\M'
  , false);
$$;

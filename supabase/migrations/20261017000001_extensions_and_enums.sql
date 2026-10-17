-- BUILD.md 5.1: extensions and enums.
-- pgcrypto goes in the extensions schema so it is not exposed from public.
-- pg_cron and pg_net install into their own schemas (cron, net).
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create type user_role           as enum ('student', 'admin');
create type trip_status         as enum ('open', 'cancelled', 'past');
create type seat_request_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'expired');
create type ride_request_status as enum ('open', 'matched', 'expired', 'cancelled');
create type offer_status        as enum ('pending', 'accepted', 'declined', 'withdrawn', 'expired', 'closed');
create type flexibility_kind    as enum ('exact', 'pm30', 'pm60', 'anytime');
create type report_status       as enum ('new', 'reviewing', 'actioned', 'dismissed');
create type report_target       as enum ('user', 'trip', 'request', 'message');
create type meetup_status       as enum ('approved', 'suspended', 'retired');

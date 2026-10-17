-- Step 2: row-level security. BUILD.md 5.8.
alter table profiles              enable row level security;
alter table blocks                enable row level security;
alter table campuses              enable row level security;
alter table places                enable row level security;
alter table meetup_points         enable row level security;
alter table meetup_point_details  enable row level security;
alter table trips                 enable row level security;
alter table trip_private          enable row level security;
alter table seat_requests         enable row level security;
alter table ride_requests         enable row level security;
alter table ride_offers           enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table reports               enable row level security;
alter table email_outbox          enable row level security;   -- no policies: service role only
alter table audit_log             enable row level security;
alter table rate_events           enable row level security;   -- no policies: functions only

-- Table privileges, as a second lock behind the policies.
-- Signed-out visitors get nothing. Signed-in users never write the RPC-only tables directly.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on
  trips, trip_private, seat_requests, ride_requests, ride_offers, blocks, reports,
  conversations, audit_log from authenticated;
revoke all on email_outbox, rate_events from authenticated;
-- Messages: insert only, through the policy below. Nothing edits or deletes a message.
revoke update, delete on messages from authenticated;

-- Profiles: the person edits a short list of columns and nothing else
-- (role, onboarded_at, suspended_until, deleted_at, campus_id stay out of reach).
revoke insert, update, delete on profiles from authenticated;
grant update (first_name, last_name, class_year, bio, avatar_path, notification_prefs)
  on profiles to authenticated;

-- Reference tables ----------------------------------------------------------------------------
create policy campuses_read on campuses for select to authenticated using (active or is_admin());
create policy campuses_admin on campuses for all to authenticated
  using (is_admin()) with check (is_admin());

create policy places_read on places for select to authenticated using (active or is_admin());
create policy places_admin on places for all to authenticated
  using (is_admin()) with check (is_admin());

-- Approved points are open to everyone signed in. A point that was suspended or retired stays
-- readable for the trips and requests that already use it ("existing trips keep theirs").
create policy meetup_points_read on meetup_points for select to authenticated using (
  status = 'approved'
  or is_admin()
  or exists (select 1 from trips t where t.meetup_point_id = meetup_points.id)
  or exists (select 1 from ride_requests r where r.meetup_point_id = meetup_points.id)
);
create policy meetup_points_admin on meetup_points for all to authenticated
  using (is_admin()) with check (is_admin());

create policy meetup_point_details_read on meetup_point_details for select to authenticated using (
  is_admin()
  or exists (select 1 from trips t
             where t.meetup_point_id = meetup_point_details.point_id and can_see_trip_private(t.id))
);
create policy meetup_point_details_admin on meetup_point_details for all to authenticated
  using (is_admin()) with check (is_admin());

-- People --------------------------------------------------------------------------------------
-- Others read public_profiles, never this table.
create policy profiles_read on profiles for select to authenticated
  using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy blocks_read on blocks for select to authenticated using (blocker_id = auth.uid());

-- Trips and what hangs off them ----------------------------------------------------------------
create policy trips_read on trips for select to authenticated using (
  not is_blocked_pair(auth.uid(), driver_id)
  and (status <> 'cancelled' or driver_id = auth.uid() or has_accepted_seat(id))
);

create policy trip_private_read on trip_private for select to authenticated
  using (can_see_trip_private(trip_id));

create policy seat_requests_read on seat_requests for select to authenticated
  using (rider_id = auth.uid() or is_trip_driver(trip_id) or is_admin());

create policy ride_requests_read on ride_requests for select to authenticated using (
  rider_id = auth.uid()
  or (status = 'open' and not is_blocked_pair(auth.uid(), rider_id))
);

create policy ride_offers_read on ride_offers for select to authenticated using (
  driver_id = auth.uid()
  or exists (select 1 from ride_requests r where r.id = ride_offers.request_id and r.rider_id = auth.uid())
);

-- Chat ------------------------------------------------------------------------------------------
create policy conversations_read on conversations for select to authenticated
  using (auth.uid() in (driver_id, rider_id));

create policy messages_read on messages for select to authenticated using (
  exists (select 1 from conversations c
          where c.id = conversation_id and auth.uid() in (c.driver_id, c.rider_id))
);

create policy messages_insert on messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from conversations c
              where c.id = conversation_id
                and auth.uid() in (c.driver_id, c.rider_id)
                and now() < c.closes_at
                and not is_blocked_pair(c.driver_id, c.rider_id))
);

-- Moderation ------------------------------------------------------------------------------------
create policy reports_read on reports for select to authenticated
  using (reporter_id = auth.uid() or is_admin());

create policy audit_log_read on audit_log for select to authenticated using (is_admin());

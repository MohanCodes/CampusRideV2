-- Step 4: the board. Two read-only views, so one request returns everything a card needs.
-- security_invoker means each reader's own row-level security still applies: blocked people and
-- cancelled trips never show up. Neither view exposes the plate or the exact meetup spot.

create view board_trips with (security_invoker = true) as
select t.id, t.driver_id, t.place_id, t.destination_name, t.departs_at, t.back_by,
       t.seats_total, t.seats_taken, (t.seats_total - t.seats_taken) as seats_left,
       t.meetup_point_id, mp.name as meetup_point_name,
       t.car_make, t.car_color, t.cost_note, t.notes, t.created_at,
       coalesce(pl.chip, 'Other') as chip,
       pp.first_name as driver_first_name, pp.campus_id as driver_campus_id,
       pp.class_year as driver_class_year, pp.avatar_path as driver_avatar_path
from trips t
join public_profiles pp on pp.id = t.driver_id
left join meetup_points mp on mp.id = t.meetup_point_id
left join places pl on pl.id = t.place_id
where t.status = 'open' and t.departs_at > now() and t.seats_taken < t.seats_total;

create view board_requests with (security_invoker = true) as
select r.id, r.rider_id, r.place_id, r.destination_name, r.window_start, r.window_end,
       r.flexibility, r.seats, r.meetup_point_id, mp.name as meetup_point_name,
       r.chip_in, r.note, r.created_at,
       coalesce(pl.chip, 'Other') as chip,
       pp.first_name as rider_first_name, pp.campus_id as rider_campus_id,
       pp.class_year as rider_class_year, pp.avatar_path as rider_avatar_path
from ride_requests r
join public_profiles pp on pp.id = r.rider_id
left join meetup_points mp on mp.id = r.meetup_point_id
left join places pl on pl.id = r.place_id
where r.status = 'open' and r.window_end > now();

revoke all on board_trips, board_requests from anon, authenticated;
grant select on board_trips, board_requests to authenticated;

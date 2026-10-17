-- BUILD.md 5.4: trips, requests, offers, chat.
create table trips (
  id               uuid primary key default gen_random_uuid(),
  driver_id        uuid not null references profiles(id),
  place_id         text references places(id),
  destination_name text not null,                  -- copied from the place, or the "Other" result
  destination_lat  double precision,
  destination_lng  double precision,
  departs_at       timestamptz not null,
  back_by          timestamptz,
  seats_total      int not null check (seats_total between 1 and 6),
  seats_taken      int not null default 0 check (seats_taken >= 0),
  meetup_point_id  uuid not null references meetup_points(id),
  car_make         text not null,
  car_color        text not null,
  cost_note        text check (char_length(cost_note) <= 200),
  notes            text check (char_length(notes) <= 300),
  status           trip_status not null default 'open',
  from_request_id  uuid,                           -- set when posted to answer an "In search of" request
  created_at       timestamptz not null default now(),
  check (seats_taken <= seats_total),
  check (back_by is null or back_by > departs_at),
  check (not contains_contact_info(coalesce(cost_note,'') || ' ' || coalesce(notes,'')))
);

create table trip_private (                         -- plate stays hidden until a seat is accepted
  trip_id    uuid primary key references trips(id) on delete cascade,
  car_plate  text not null check (char_length(car_plate) between 2 and 10)
);

create table seat_requests (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  rider_id    uuid not null references profiles(id),
  seats       int not null check (seats between 1 and 3),
  message     text check (char_length(message) <= 300),
  status      seat_request_status not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (trip_id, rider_id)
);

create table ride_requests (                        -- "In search of"
  id                uuid primary key default gen_random_uuid(),
  rider_id          uuid not null references profiles(id),
  place_id          text references places(id),
  destination_name  text not null,
  destination_lat   double precision,
  destination_lng   double precision,
  window_start      timestamptz not null,
  window_end        timestamptz not null,
  flexibility       flexibility_kind not null default 'pm30',
  seats             int not null default 1 check (seats between 1 and 3),
  meetup_point_id   uuid not null references meetup_points(id),
  chip_in           boolean not null default true,
  note              text check (char_length(note) <= 200 and not contains_contact_info(note)),
  status            ride_request_status not null default 'open',
  matched_trip_id   uuid references trips(id),
  created_at        timestamptz not null default now(),
  check (window_end > window_start)                -- the 7-day limit is enforced in post_ride_request
);

create table ride_offers (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references ride_requests(id) on delete cascade,
  driver_id   uuid not null references profiles(id),
  trip_id     uuid not null references trips(id) on delete cascade,
  message     text check (char_length(message) <= 300),
  status      offer_status not null default 'pending',
  created_at  timestamptz not null default now(),
  unique (request_id, trip_id)
);

create table conversations (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  driver_id   uuid not null references profiles(id),
  rider_id    uuid not null references profiles(id),
  closes_at   timestamptz not null,                -- departs_at + 24 hours
  created_at  timestamptz not null default now(),
  unique (trip_id, rider_id)
);

create table messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id),
  body             text not null check (char_length(body) between 1 and 1000),
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);

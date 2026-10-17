-- BUILD.md 5.2: reference tables.
create table campuses (
  id             text primary key,                -- 'hmc', 'pomona', 'scripps', 'cmc', 'pitzer'
  name           text not null,
  email_domains  text[] not null,
  timezone       text not null default 'America/Los_Angeles',
  safety_phone   text,
  active         boolean not null default true
);

create table places (                              -- curated destinations
  id        text primary key,                      -- 'tj-claremont'
  name      text not null,
  category  text not null,
  address   text not null,
  chip      text not null,                         -- feed chip it belongs to
  lat       double precision,
  lng       double precision,
  active    boolean not null default true
);

create table meetup_points (
  id          uuid primary key default gen_random_uuid(),
  campus_id   text not null references campuses(id),
  name        text not null,
  type        text not null,                       -- hub, academic, residence, shared, transit
  lat         double precision not null,
  lng         double precision not null,
  shared      boolean not null default false,      -- visible to every campus
  status      meetup_status not null default 'approved',
  created_at  timestamptz not null default now()
);

-- Where exactly to stand. Only visible to the driver and accepted riders (BUILD.md 5.8).
create table meetup_point_details (
  point_id  uuid primary key references meetup_points(id) on delete cascade,
  stand_at  text not null
);

# Waiting on the team

Items the Step 1 seed cannot fill without made-up values. Nothing here is guessed.

## Meetup points (not seeded)

`meetup_points.lat` and `lng` are `NOT NULL`, and `MUDD.md` has no coordinates. They need the
geocoding pass described in `BUILD.md` Section 9, which needs the Mapbox token. Each point also
needs `stand_at` text ("where exactly to stand") from someone who has the campus map in hand.

Harvey Mudd (from `MUDD.md` Section 3): Platt Campus Center, Hoch-Shanahan Dining Commons,
Linde Activities Center, Shanahan Center, Atwood, Case, Drinkward, East, Linde, North, Sontag,
South and West Halls.

Shared (`shared = true`): Honnold/Mudd Library, Smith Campus Center, Balch Hall, Claremont Depot.

Pomona, Scripps, Claremont McKenna and Pitzer points are added through the admin page after each
college confirms where short pickups are allowed. Garrett House is private and is not a point.

## Campus safety phone numbers

Only Harvey Mudd's (909-607-2000) is verified. `safety_phone` is null for Pomona, Scripps,
Claremont McKenna and Pitzer until each is confirmed.

## Email domains

All seven domains in `seed.sql` still need confirming with each college's IT office.

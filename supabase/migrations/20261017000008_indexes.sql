-- BUILD.md 5.7: indexes.
create index trips_board_idx        on trips (status, departs_at);
create index trips_driver_idx       on trips (driver_id, departs_at);
create index trips_place_idx        on trips (place_id, departs_at) where status = 'open';
create index seat_requests_trip_idx on seat_requests (trip_id, status);
create index seat_requests_rider_idx on seat_requests (rider_id, status);
create index ride_requests_open_idx on ride_requests (status, window_end);
create index ride_requests_rider_idx on ride_requests (rider_id, status);
create index ride_offers_request_idx on ride_offers (request_id, status);
create index ride_offers_driver_idx  on ride_offers (driver_id, status);
create index messages_conv_idx      on messages (conversation_id, created_at);
create index email_outbox_due_idx   on email_outbox (send_after) where sent_at is null;
create index reports_status_idx     on reports (status, created_at);

-- Optional Google listing details chosen by an administrator.
-- Existing businesses keep their current review links. Place IDs may be stored.
-- Customer feedback is still not stored.

alter table public.businesses
  add column if not exists address text,
  add column if not exists google_place_id text,
  add column if not exists google_maps_url text;

alter table public.businesses drop constraint if exists businesses_address_len;
alter table public.businesses
  add constraint businesses_address_len
  check (address is null or char_length(btrim(address)) between 1 and 300);

alter table public.businesses drop constraint if exists businesses_place_id_format;
alter table public.businesses
  add constraint businesses_place_id_format
  check (google_place_id is null or google_place_id ~ '^[A-Za-z0-9_-]{8,255}$');

alter table public.businesses drop constraint if exists businesses_maps_url;
alter table public.businesses
  add constraint businesses_maps_url
  check (
    google_maps_url is null
    or (
      char_length(google_maps_url) between 12 and 500
      and position(' ' in google_maps_url) = 0
      and (
        google_maps_url ~ '^https://maps\.app\.goo\.gl/.+'
        or google_maps_url ~ '^https://maps\.google\.[a-z.]{2,20}/.+'
        or google_maps_url ~ '^https://(www\.)?google\.[a-z.]{2,20}/maps.+'
      )
    )
  );

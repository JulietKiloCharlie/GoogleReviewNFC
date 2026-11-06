-- Syntrex Review Platform
-- Customer feedback messages are intentionally not stored.

create extension if not exists pgcrypto;

create or replace function public.is_google_review_url(url text)
returns boolean
language sql
immutable
as $$
  select url is not null
    and char_length(url) between 12 and 500
    and position(' ' in url) = 0
    and position('@' in url) = 0
    and (
      url ~ '^https://search\.google\.com/local/writereview([/?#].*)?$'
      or url ~ '^https://g\.page/.+'
      or url ~ '^https://maps\.app\.goo\.gl/.+'
      or url ~ '^https://(www\.)?google\.[a-z.]{2,20}/maps.+'
      or url ~ '^https://maps\.google\.[a-z.]{2,20}/.+'
    );
$$;

create or replace function public.is_email(value text)
returns boolean
language sql
immutable
as $$
  select value is not null
    and char_length(value) <= 320
    and value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
$$;

create table public.administrators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  constraint administrators_email_valid check (public.is_email(email))
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.administrators
    where user_id = auth.uid()
  );
$$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  logo_path text check (logo_path is null or logo_path ~ '^[A-Za-z0-9][A-Za-z0-9/_-]{0,180}\.(png|jpe?g|webp)$'),
  description text check (description is null or char_length(description) <= 280),
  feedback_email text check (feedback_email is null or public.is_email(feedback_email)),
  feedback_email_verified boolean not null default false,
  pending_feedback_email text check (pending_feedback_email is null or public.is_email(pending_feedback_email)),
  google_review_url text not null check (public.is_google_review_url(google_review_url)),
  welcome_message text not null default 'How was your experience with us?' check (char_length(welcome_message) between 1 and 160),
  thank_you_message text not null default 'Thank you for taking the time to share your feedback.' check (char_length(thank_you_message) between 1 and 200),
  accent_colour text not null default '#d7c4a3' check (accent_colour ~ '^#[0-9a-fA-F]{6}$'),
  status text not null check (status in ('draft', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_verified_requires_email check (feedback_email_verified = false or feedback_email is not null)
);

create index businesses_status_created_idx on public.businesses (status, created_at desc);

create table public.slug_redirects (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 80),
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index slug_redirects_business_idx on public.slug_redirects (business_id);

create table public.email_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (public.is_email(email)),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index email_verifications_business_idx on public.email_verifications (business_id, created_at desc);

-- Stores only counters. Customer messages are never written here.
create table public.feedback_rate_limits (
  bucket text primary key,
  hits integer not null check (hits > 0),
  window_start timestamptz not null
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger businesses_touch_updated_at
before update on public.businesses
for each row execute function public.touch_updated_at();

create or replace function public.guard_business_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.slug_redirects
    where slug = new.slug and business_id <> new.id
  ) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  delete from public.slug_redirects
  where slug = new.slug and business_id = new.id;

  return new;
end;
$$;

create trigger businesses_guard_slug
before insert or update of slug on public.businesses
for each row execute function public.guard_business_slug();

create or replace function public.guard_redirect_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.businesses where slug = new.slug) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger redirects_guard_slug
before insert or update of slug on public.slug_redirects
for each row execute function public.guard_redirect_slug();

create or replace function public.get_public_page(page_slug text)
returns table (
  name text,
  slug text,
  logo_path text,
  description text,
  google_review_url text,
  welcome_message text,
  thank_you_message text,
  accent_colour text,
  page_status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target_id uuid;
  target_slug text;
begin
  if page_slug is null or page_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return;
  end if;

  select b.id, b.slug into target_id, target_slug
  from public.businesses b
  where b.slug = page_slug and b.status in ('active', 'disabled');

  if target_id is null then
    select b.id, b.slug into target_id, target_slug
    from public.slug_redirects r
    join public.businesses b on b.id = r.business_id
    where r.slug = page_slug and b.status in ('active', 'disabled');
  end if;

  if target_id is null then
    return;
  end if;

  return query
  select
    b.name,
    b.slug,
    b.logo_path,
    b.description,
    b.google_review_url,
    b.welcome_message,
    b.thank_you_message,
    b.accent_colour,
    b.status
  from public.businesses b
  where b.id = target_id;
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.get_public_page(text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_public_page(text) to anon, authenticated;

alter table public.administrators enable row level security;
alter table public.businesses enable row level security;
alter table public.slug_redirects enable row level security;
alter table public.email_verifications enable row level security;
alter table public.feedback_rate_limits enable row level security;

grant select on public.administrators to authenticated;
grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, delete on public.slug_redirects to authenticated;

create policy administrators_read_self
on public.administrators
for select
to authenticated
using (user_id = auth.uid());

create policy businesses_admin_all
on public.businesses
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy redirects_admin_all
on public.slug_redirects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

create policy logos_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'logos');

create policy logos_admin_insert
on storage.objects
for insert
to authenticated
with check (bucket_id = 'logos' and public.is_admin());

create policy logos_admin_update
on storage.objects
for update
to authenticated
using (bucket_id = 'logos' and public.is_admin())
with check (bucket_id = 'logos' and public.is_admin());

create policy logos_admin_delete
on storage.objects
for delete
to authenticated
using (bucket_id = 'logos' and public.is_admin());

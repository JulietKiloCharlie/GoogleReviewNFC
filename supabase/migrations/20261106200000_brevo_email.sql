-- Delivers private mail through Brevo. Messages are not stored.
-- The API key and sender address live in Vault, not in the app.

create or replace function public.deliver_private_email(
  recipient text,
  subject text,
  body text,
  reply_to text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  api_key text;
  sender_email text;
  clean_reply text;
  payload jsonb;
  response record;
  provider_message text;
begin
  if recipient is null or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'Save a valid feedback email first.');
  end if;

  select decrypted_secret into api_key
  from vault.decrypted_secrets
  where name = 'brevo_api_key'
  limit 1;

  select decrypted_secret into sender_email
  from vault.decrypted_secrets
  where name = 'brevo_sender_email'
  limit 1;

  if coalesce(api_key, '') = '' or coalesce(sender_email, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'The email service is not ready yet. Add the Brevo mail key, then try again.');
  end if;

  clean_reply := btrim(coalesce(reply_to, ''));
  payload := jsonb_build_object(
    'sender', jsonb_build_object('name', 'Syntrex', 'email', sender_email),
    'to', jsonb_build_array(jsonb_build_object('email', recipient)),
    'subject', left(subject, 180),
    'textContent', body
  );

  if clean_reply ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    payload := payload || jsonb_build_object('replyTo', jsonb_build_object('email', clean_reply));
  end if;

  select status, content
    into response
  from http((
    'POST',
    'https://api.brevo.com/v3/smtp/email',
    array[
      http_header('api-key', api_key),
      http_header('accept', 'application/json'),
      http_header('content-type', 'application/json')
    ],
    'application/json',
    payload::text
  )::http_request);

  if response.status in (200, 201, 202) then
    return jsonb_build_object('ok', true);
  end if;

  provider_message := '';
  if left(ltrim(coalesce(response.content, '')), 1) = '{' then
    provider_message := coalesce(response.content::jsonb ->> 'message', '');
  end if;

  if provider_message ilike '%not yet activated%' or provider_message ilike '%not valid%' or provider_message ilike '%sender%' then
    return jsonb_build_object('ok', false, 'error', 'Verify the sender address in Brevo, then try again.');
  end if;

  if response.status in (401, 403) then
    return jsonb_build_object('ok', false, 'error', 'The Brevo mail key was rejected. Create a new key and save it again.');
  end if;

  return jsonb_build_object('ok', false, 'error', 'The email service could not deliver the message.');
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'The email service could not deliver the message.');
end;
$$;

create or replace function public.send_public_feedback(
  page_slug text,
  star_rating integer,
  feedback_message text,
  customer_name text default '',
  customer_email text default '',
  company_website text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  business_name text;
  target_email text;
  clean_message text;
  clean_name text;
  clean_customer_email text;
  hour_bucket timestamptz;
  ip_key text;
  biz_key text;
  ip_hits integer;
  biz_hits integer;
  delivery jsonb;
begin
  if coalesce(company_website, '') <> '' then
    return jsonb_build_object('ok', true);
  end if;

  if page_slug is null or page_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return jsonb_build_object('ok', false, 'error', 'Choose a rating and try again.');
  end if;

  if star_rating is null or star_rating < 1 or star_rating > 5 then
    return jsonb_build_object('ok', false, 'error', 'Choose a rating and try again.');
  end if;

  clean_message := btrim(coalesce(feedback_message, ''));
  if clean_message = '' or char_length(clean_message) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'Enter the feedback.');
  end if;

  clean_name := left(btrim(coalesce(customer_name, '')), 120);
  clean_customer_email := left(btrim(coalesce(customer_email, '')), 320);
  if clean_customer_email <> '' and clean_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid email address, or leave it blank.');
  end if;

  select b.name, coalesce(b.feedback_email, b.pending_feedback_email)
    into business_name, target_email
  from public.businesses b
  where b.slug = page_slug
    and b.status = 'active';

  if business_name is null then
    return jsonb_build_object('ok', false, 'error', 'This review page is not available.');
  end if;

  if target_email is null then
    return jsonb_build_object('ok', false, 'error', 'This business has not saved a feedback email yet.');
  end if;

  hour_bucket := date_trunc('hour', now());
  ip_key := 'ip:' || md5(coalesce(current_setting('request.headers', true), '') || hour_bucket::text);
  biz_key := 'biz:' || page_slug || ':' || hour_bucket::text;

  insert into public.feedback_rate_limits (bucket, hits, window_start)
  values (ip_key, 1, hour_bucket)
  on conflict (bucket) do update
  set hits = public.feedback_rate_limits.hits + 1
  returning hits into ip_hits;

  insert into public.feedback_rate_limits (bucket, hits, window_start)
  values (biz_key, 1, hour_bucket)
  on conflict (bucket) do update
  set hits = public.feedback_rate_limits.hits + 1
  returning hits into biz_hits;

  if ip_hits > 5 or biz_hits > 30 then
    return jsonb_build_object('ok', false, 'error', 'Too many messages were sent just now. Please wait and try again.');
  end if;

  delivery := public.deliver_private_email(
    target_email,
    'New private feedback for ' || business_name,
    concat(
      'Rating: ', star_rating, '/5', E'\n',
      'Name: ', case when clean_name = '' then 'Not provided' else clean_name end, E'\n',
      'Email: ', case when clean_customer_email = '' then 'Not provided' else clean_customer_email end, E'\n\n',
      clean_message, E'\n\n',
      'This message was sent from the Syntrex review page so the business could read it directly. Syntrex does not store the message.'
    ),
    clean_customer_email
  );

  return delivery;
end;
$$;

create or replace function public.request_feedback_inbox_confirmation(target_business uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  business_name text;
  target_email text;
  delivery jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'Sign in as an administrator and try again.');
  end if;

  select b.name, coalesce(nullif(btrim(b.pending_feedback_email), ''), nullif(btrim(b.feedback_email), ''))
    into business_name, target_email
  from public.businesses b
  where b.id = target_business;

  if business_name is null or target_email is null then
    return jsonb_build_object('ok', false, 'error', 'Save a feedback email first.');
  end if;

  delivery := public.deliver_private_email(
    target_email,
    'Confirm feedback email for ' || business_name,
    concat(
      'This inbox is ready to receive private review notes for ', business_name, '.', E'\n\n',
      'Customer notes will arrive here. Syntrex does not store them.'
    ),
    ''
  );

  if coalesce(delivery ->> 'ok', '') <> 'true' then
    return delivery;
  end if;

  update public.businesses
  set feedback_email = target_email,
      pending_feedback_email = target_email,
      feedback_email_verified = true
  where id = target_business;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.deliver_private_email(text, text, text, text) from public;
revoke all on function public.send_public_feedback(text, integer, text, text, text, text) from public;
revoke all on function public.request_feedback_inbox_confirmation(uuid) from public;
grant execute on function public.send_public_feedback(text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.request_feedback_inbox_confirmation(uuid) to authenticated;

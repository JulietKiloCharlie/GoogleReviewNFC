-- Sends private feedback through FormSubmit. The message is not stored.

create extension if not exists http with schema extensions;

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
  payload jsonb;
  response record;
  hour_bucket timestamptz;
  ip_key text;
  biz_key text;
  ip_hits integer;
  biz_hits integer;
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

  payload := jsonb_build_object(
    'name', case when clean_name = '' then 'Customer' else clean_name end,
    'message', concat(
      'Rating: ', star_rating, '/5', E'\n',
      'Name: ', case when clean_name = '' then 'Not provided' else clean_name end, E'\n',
      'Email: ', case when clean_customer_email = '' then 'Not provided' else clean_customer_email end, E'\n\n',
      clean_message, E'\n\n',
      'This message was sent from the Syntrex Group Limited review page so the business could read it directly. Syntrex Group Limited does not store the message.'
    ),
    '_subject', 'New private feedback for ' || business_name,
    '_captcha', 'false',
    '_template', 'box'
  );

  if clean_customer_email <> '' then
    payload := payload || jsonb_build_object('_replyto', clean_customer_email);
  end if;

  select status, content
    into response
  from extensions.http_post(
    'https://formsubmit.co/ajax/' || target_email,
    payload::text,
    'application/json'
  );

  if response.status < 200 or response.status >= 300 or coalesce(response.content::jsonb ->> 'success', '') not in ('true', 'True') then
    return jsonb_build_object('ok', false, 'error', 'The email service could not deliver the message.');
  end if;

  return jsonb_build_object('ok', true);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'The email service could not deliver the message.');
end;
$$;

revoke all on function public.send_public_feedback(text, integer, text, text, text, text) from public;
grant execute on function public.send_public_feedback(text, integer, text, text, text, text) to anon, authenticated;

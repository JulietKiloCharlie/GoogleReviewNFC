-- Asks FormSubmit to email the business inbox a confirmation.
-- The message is not stored. Only an administrator can call this.

create or replace function public.request_feedback_inbox_confirmation(target_business uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  business_name text;
  target_email text;
  payload jsonb;
  response record;
  provider_message text;
  provider_ok boolean;
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

  payload := jsonb_build_object(
    'name', 'Syntrex Group Limited',
    'message', concat(
      'Confirm this inbox so private review notes for ', business_name, ' can be delivered.', E'\n\n',
      'If this is the first email, open the message from FormSubmit and activate the address. Later customer notes will arrive here. Syntrex Group Limited does not store them.'
    ),
    '_subject', 'Confirm feedback email for ' || business_name,
    '_captcha', 'false',
    '_template', 'box'
  );

  select status, content
    into response
  from extensions.http_post(
    'https://formsubmit.co/ajax/' || target_email,
    payload::text,
    'application/json'
  );

  provider_message := coalesce(response.content::jsonb ->> 'message', '');
  provider_ok := coalesce(response.content::jsonb ->> 'success', '') in ('true', 'True');

  if response.status >= 200 and response.status < 300 and (
    provider_ok
    or provider_message ilike '%activ%'
    or provider_message ilike '%confirm%'
  ) then
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'The confirmation email could not be sent. Wait a minute and try again.');
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'The confirmation email could not be sent. Wait a minute and try again.');
end;
$$;

revoke all on function public.request_feedback_inbox_confirmation(uuid) from public;
grant execute on function public.request_feedback_inbox_confirmation(uuid) to authenticated;

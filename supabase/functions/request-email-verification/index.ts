import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import { json, preflight } from "../_shared/http.ts";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Sign in required." }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(url, serviceKey);
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Sign in required." }, 401);

  const { data: admin } = await service
    .from("administrators")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!admin) return json({ error: "You do not have access to this dashboard." }, 403);

  let body: { businessId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "The request could not be read." }, 400);
  }

  const { data: business } = await service
    .from("businesses")
    .select("id, name, pending_feedback_email")
    .eq("id", body.businessId ?? "")
    .maybeSingle();
  if (!business?.pending_feedback_email) return json({ error: "Save a feedback email before sending verification." }, 400);

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("email_verifications")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .gte("created_at", since);
  if ((count ?? 0) >= 3) return json({ error: "A verification email was sent recently. Wait a while before trying again." }, 429);

  const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await sha256(token);
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  if (!appUrl) return json({ error: "APP_URL is not configured for verification links." }, 500);

  await service.from("email_verifications").delete().eq("business_id", business.id);
  const { error: insertError } = await service.from("email_verifications").insert({
    business_id: business.id,
    email: business.pending_feedback_email,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  });
  if (insertError) return json({ error: "The verification email could not be prepared." }, 500);

  const sent = await sendEmail(
    business.pending_feedback_email,
    `Confirm feedback email for ${business.name}`,
    [
      `Confirm that ${business.pending_feedback_email} should receive private customer feedback for ${business.name}.`,
      "",
      "Open this link within 48 hours:",
      `${appUrl}/verify-email#${token}`,
      "",
      "Customer messages are emailed to this address and are not stored by Syntrex Group Limited.",
      "The email provider processes the message only so it can be delivered.",
    ].join("\n"),
  );

  if (!sent.ok) {
    await service.from("email_verifications").delete().eq("token_hash", tokenHash);
    return json({ error: sent.error }, 502);
  }

  return json({ ok: true });
});

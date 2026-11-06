import { createClient } from "npm:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/http.ts";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "The confirmation link could not be read." }, 400);
  }

  const token = (body.token ?? "").trim();
  if (token.length < 20 || token.length > 200) return json({ error: "This confirmation link is not valid." }, 400);

  const tokenHash = await sha256(token);
  const { data: row } = await service
    .from("email_verifications")
    .select("id, business_id, email, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return json({ error: "This confirmation link has expired. Ask Syntrex Group Limited to send a new one." }, 400);
  }

  const { error } = await service
    .from("businesses")
    .update({
      feedback_email: row.email,
      feedback_email_verified: true,
      pending_feedback_email: null,
    })
    .eq("id", row.business_id);
  if (error) return json({ error: "The email address could not be confirmed." }, 500);

  await service.from("email_verifications").delete().eq("business_id", row.business_id);
  return json({ ok: true });
});

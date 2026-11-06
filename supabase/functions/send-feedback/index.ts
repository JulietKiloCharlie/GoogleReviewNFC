import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email.ts";
import { json, preflight } from "../_shared/http.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function limited(
  service: ReturnType<typeof createClient>,
  bucket: string,
  maximum: number,
): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setMinutes(0, 0, 0);
  const key = `${bucket}:${windowStart.toISOString()}`;
  const { data } = await service.from("feedback_rate_limits").select("hits").eq("bucket", key).maybeSingle();
  const hits = (data?.hits ?? 0) + 1;
  if (hits > maximum) return true;
  await service.from("feedback_rate_limits").upsert({ bucket: key, hits, window_start: windowStart.toISOString() });
  return false;
}

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;

  const service = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  let body: {
    slug?: string;
    rating?: number;
    message?: string;
    customerName?: string;
    customerEmail?: string;
    companyWebsite?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "The feedback could not be read." }, 400);
  }

  if (body.companyWebsite) return json({ ok: true });

  const slug = (body.slug ?? "").trim();
  const message = (body.message ?? "").trim();
  const rating = body.rating;
  const customerName = (body.customerName ?? "").trim().slice(0, 120);
  const customerEmail = (body.customerEmail ?? "").trim().slice(0, 320);

  if (!SLUG.test(slug) || !Number.isInteger(rating) || rating! < 1 || rating! > 5) {
    return json({ error: "Choose a rating and try again." }, 400);
  }
  if (!message || message.length > 2000) return json({ error: "Enter the feedback." }, 400);
  if (customerEmail && !EMAIL.test(customerEmail)) return json({ error: "Enter a valid email address, or leave it blank." }, 400);

  const { data: business } = await service
    .from("businesses")
    .select("id, name, feedback_email, feedback_email_verified, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!business || business.status !== "active" || !business.feedback_email_verified || !business.feedback_email) {
    return json({ error: "Private feedback is not available for this business yet." }, 400);
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipHash = await sha256(`${Deno.env.get("SUPABASE_URL")}:${forwarded}`);
  if (await limited(service, `ip:${ipHash}`, 5) || (await limited(service, `biz:${business.id}`, 30))) {
    return json({ error: "Too many messages were sent just now. Please wait and try again." }, 429);
  }

  const sent = await sendEmail(
    business.feedback_email,
    `New private feedback for ${business.name}`,
    [
      `Rating: ${rating}/5`,
      `Name: ${customerName || "Not provided"}`,
      `Email: ${customerEmail || "Not provided"}`,
      "",
      message,
      "",
      "This message was sent from the Syntrex Group Limited review page so the business could read it directly.",
      "Syntrex Group Limited does not store the message.",
    ].join("\n"),
    customerEmail || undefined,
  );

  if (!sent.ok) return json({ error: sent.error }, 502);
  return json({ ok: true });
});

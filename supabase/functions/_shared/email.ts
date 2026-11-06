export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  replyTo?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM in Supabase.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    return { ok: false, error: "The email service rejected the message." };
  }
  return { ok: true };
}

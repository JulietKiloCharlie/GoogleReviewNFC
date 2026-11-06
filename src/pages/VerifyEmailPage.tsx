import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export function VerifyEmailPage() {
  const [message, setMessage] = useState("Confirming the feedback email…");

  useEffect(() => {
    if (!supabase) {
      setMessage("Supabase is not configured, so this link cannot be confirmed yet.");
      return;
    }
    const token = window.location.hash.replace(/^#/, "");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setMessage("This confirmation link is missing its token. Ask Syntrex Group Limited to send a new one.");
      return;
    }
    supabase.functions.invoke("confirm-email", { body: { token } }).then(({ data, error }) => {
      if (error || (data && typeof data === "object" && "error" in data)) {
        const detail = data && typeof data === "object" && "error" in data ? String(data.error) : null;
        setMessage(detail || "This confirmation link is not valid. Ask Syntrex Group Limited to send a new one.");
        return;
      }
      setMessage("The feedback email is confirmed. Private customer messages can now be delivered to it.");
    });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <p className="text-xs tracking-wide text-accent">Syntrex Group Limited</p>
      <h1 className="mt-2 text-3xl font-semibold">Feedback email</h1>
      <p className="mt-4 text-muted">{supabaseConfigured ? message : "Supabase is not configured."}</p>
    </main>
  );
}

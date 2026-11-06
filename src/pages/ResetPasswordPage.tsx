import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { readableError } from "@/lib/errors";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { btnPrimary, field, label } from "@/lib/styles";
import { SetupNotice } from "@/components/SetupNotice";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) setError(readableError(updateError));
    else setMessage("Your password has been updated. You can log in.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-semibold">Choose a new password</h1>
      <div className="mt-6">{supabaseConfigured ? null : <SetupNotice />}</div>
      {supabaseConfigured ? (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className={label}>
            New password
            <input className={`${field} mt-1.5`} type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          {message ? <p className="text-sm text-good">{message}</p> : null}
          <button className={btnPrimary} disabled={busy} type="submit">
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : null}
      <Link className="mt-4 text-sm text-muted underline" to="/login">
        Back to login
      </Link>
    </main>
  );
}

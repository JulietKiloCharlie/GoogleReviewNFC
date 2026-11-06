import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { SetupNotice } from "@/components/SetupNotice";
import { readableError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { btnPrimary, field, hint, label } from "@/lib/styles";

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfa, setMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!auth.loading && auth.isAdmin) return <Navigate to="/admin" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mfa) {
        await auth.verifyMfa(code.trim());
      } else {
        const result = await auth.signIn(email, password);
        if (result === "mfa") {
          setMfa(true);
          setBusy(false);
          return;
        }
      }
      navigate("/admin");
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError(null);
    setNotice(null);
    if (!supabase) return;
    if (!email.trim()) {
      setError("Enter your administrator email first.");
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(readableError(resetError));
    else setNotice("If that email belongs to an administrator, a reset link is on its way.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs tracking-wide text-accent">Syntrex Group Limited</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">Google Review NFC Dashboard</h1>
      <p className="mt-2 text-sm text-muted">Private dashboard for Syntrex Group Limited administrators.</p>
      <div className="mt-6">{auth.configured ? null : <SetupNotice />}</div>
      {auth.configured ? (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mfa ? (
            <label className={label}>
              Authenticator code
              <input className={`${field} mt-1.5`} inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
          ) : (
            <>
              <label className={label}>
                Email
                <input className={`${field} mt-1.5`} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className={label}>
                Password
                <input className={`${field} mt-1.5`} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
            </>
          )}
          {error ? <p className="text-sm text-bad">{error}</p> : null}
          {notice ? <p className="text-sm text-good">{notice}</p> : null}
          <button className={`${btnPrimary} w-full`} disabled={busy} type="submit">
            {busy ? "Checking…" : mfa ? "Confirm code" : "Log in"}
          </button>
          {mfa ? null : (
            <button className="text-sm text-muted underline" type="button" onClick={resetPassword}>
              Forgot password
            </button>
          )}
        </form>
      ) : null}
      <Link className={`${hint} underline`} to="/">
        Back
      </Link>
    </main>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { readableError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { btnGhost, btnPrimary, field, label } from "@/lib/styles";

export function SettingsPage() {
  const auth = useAuth();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setEnrolled(Boolean(data?.totp.length));
    });
  }, []);

  async function sendReset() {
    if (!supabase || !auth.email) return;
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(auth.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) setError(readableError(resetError));
    else setNotice("A password reset email has been sent.");
  }

  async function enroll() {
    if (!supabase) return;
    setError(null);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Syntrex Group Limited admin",
    });
    if (enrollError || !data) {
      setError(enrollError ? readableError(enrollError) : "The authenticator could not be started.");
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !factorId) return;
    setError(null);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setError(readableError(challengeError));
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) setError(readableError(verifyError));
    else {
      setEnrolled(true);
      setQr(null);
      setNotice("Multifactor authentication is on for this account.");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Administrator</h2>
        <p className="mt-2 text-sm text-muted">{auth.email}</p>
        <button className={`${btnGhost} mt-4`} type="button" onClick={sendReset}>
          Email a password reset
        </button>
      </section>
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Multifactor authentication</h2>
        <p className="mt-2 text-sm text-muted">
          {enrolled ? "An authenticator app is enrolled." : "Add an authenticator app. Supabase must have TOTP enabled."}
        </p>
        {qr ? <img className="mt-4 h-44 w-44 bg-white p-2" src={qr} alt="Authenticator setup QR code" /> : null}
        {qr ? (
          <form className="mt-4 space-y-3" onSubmit={confirm}>
            <label className={label}>
              Code from the app
              <input className={`${field} mt-1.5`} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <button className={btnPrimary} type="submit">
              Confirm authenticator
            </button>
          </form>
        ) : (
          <button className={`${btnGhost} mt-4`} type="button" onClick={enroll} disabled={enrolled}>
            Set up authenticator
          </button>
        )}
      </section>
      <section className="rounded-2xl border border-line bg-panel p-5 text-sm leading-6 text-muted">
        <h2 className="font-semibold text-white">Adding another administrator</h2>
        <p className="mt-2">There is no public registration. In the Supabase dashboard, create the user, then run:</p>
        <pre className="mt-3 overflow-auto rounded-lg bg-ink p-3 text-xs text-white">{`insert into public.administrators (user_id, email)
select id, email from auth.users where email = 'person@syntrex.ie';`}</pre>
      </section>
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      {notice ? <p className="text-sm text-good">{notice}</p> : null}
    </div>
  );
}

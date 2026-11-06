
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Stars } from "@/components/Stars";
import { fetchPublicPage } from "@/lib/businesses";
import { reviewPanels } from "@/lib/rating";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { btnPrimary, field, label } from "@/lib/styles";
import type { PublicPage as PublicBusiness } from "@/lib/types";
import { logoPublicUrl } from "@/lib/urls";
import { messageError, safeAccent } from "@/lib/validation";

export function PublicPage() {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<PublicBusiness | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "setup">("loading");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) {
      setState("setup");
      return;
    }
    setState("loading");
    fetchPublicPage(slug)
      .then((result) => {
        if (!result) {
          setState("missing");
          return;
        }
        if (result.slug !== slug) {
          window.location.replace(`/${result.slug}`);
          return;
        }
        setPage(result);
        setState("ready");
        document.title = result.name;
      })
      .catch(() => setState("missing"));
  }, [slug]);

  if (state === "loading")
    return <main className="grid min-h-screen place-items-center">Loading…</main>;

  if (state === "setup") {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center text-muted">
        This review page is not connected yet.
      </main>
    );
  }

  if (state === "missing" || !page) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-semibold">Page not found</h1>
          <p className="mt-2 text-muted">This review link is not available.</p>
        </div>
      </main>
    );
  }

  if (page.page_status === "disabled") {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-semibold">{page.name}</h1>
          <p className="mt-2 text-muted">
            This review page is currently unavailable.
          </p>
        </div>
      </main>
    );
  }

  const accent = safeAccent(page.accent_colour);
  const panels = reviewPanels(rating);
  const logo = logoPublicUrl(page.logo_path);

  async function submitFeedback(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !page) return;

    const problem = messageError(message);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: sendError } = await supabase.rpc(
      "send_public_feedback",
      {
        page_slug: page.slug,
        star_rating: rating,
        feedback_message: message,
        customer_name: name,
        customer_email: email,
        company_website: honeypot,
      }
    );

    setBusy(false);

    if (
      sendError ||
      !data ||
      typeof data !== "object" ||
      !("ok" in data) ||
      data.ok !== true
    ) {
      const detail =
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : null;

      setError(
        detail ||
          (sendError
            ? sendError.message
            : "The feedback could not be sent. Please try again.")
      );
      return;
    }

    setDone(true);
  }

  function feedbackForm() {
    if (done)
      return (
        <p className="text-good">
          Thank you. Your feedback has been sent directly to the business.
        </p>
      );

    return (
      <form className="space-y-3" onSubmit={submitFeedback}>
        <label className={label}>
          Feedback
          <textarea
            className={`${field} mt-1.5 min-h-28`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
        </label>

        <label className={label}>
          Name <span className="font-normal text-muted">(optional)</span>
          <input
            className={`${field} mt-1.5`}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className={label}>
          Email <span className="font-normal text-muted">(optional)</span>
          <input
            className={`${field} mt-1.5`}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <div className="hidden" aria-hidden="true">
          <label>
            Company website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </label>
        </div>

        <button
          className={btnPrimary}
          style={{ background: accent, color: "#101114" }}
          disabled={busy}
          type="submit"
        >
          {busy ? "Sending…" : "Submit feedback"}
        </button>

        <p className="text-xs leading-5 text-muted">
          Your message is emailed directly to the business. Syntrex Group Limited does not store it. You do not need an account.
        </p>

        {error ? <p className="text-sm text-bad">{error}</p> : null}
      </form>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-8">
      <div className="flex flex-1 flex-col items-center text-center">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <div
            className="grid h-20 w-20 place-items-center rounded-2xl text-2xl"
            style={{ background: accent, color: "#101114" }}
          >
            {page.name.slice(0, 1)}
          </div>
        )}

        <h1 className="mt-4 text-3xl font-semibold">{page.name}</h1>

        {page.description ? (
          <p className="mt-2 text-sm text-muted">{page.description}</p>
        ) : null}

        <p className="mt-6 text-lg">{page.welcome_message}</p>

        <div className="mt-4">
          <Stars
            value={rating}
            accent={accent}
            onChange={(next) => {
              setRating(next);
              if (next >= 4)
                window.location.assign(page.google_review_url);
            }}
          />
        </div>

        {panels?.primary === "feedback" ? (
          <div className="mt-6 w-full space-y-6 text-left">
            <section className="rounded-2xl border border-line bg-panel p-4">
              {feedbackForm()}
            </section>
          </div>
        ) : panels ? (
          <p className="mt-6 text-sm text-muted">
            Opening Google Reviews…
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Choose a star rating.
          </p>
        )}
      </div>
      <div className="mt-10 flex flex-col items-center gap-2">
        <p className="text-xs text-muted">Powered by</p>
        <BrandLogo className="h-8 w-auto rounded-md" />
      </div>
    </main>
  );
}


import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { QrCard } from "@/components/QrCard";
import {
  createBusiness,
  getBusiness,
  resendVerification,
  saveError,
  updateBusiness,
  type SaveMode,
} from "@/lib/businesses";
import { DEFAULT_ACCENT, DEFAULT_THANKS, DEFAULT_WELCOME, LIMITS } from "@/lib/constants";
import { logoFileError } from "@/lib/logo";
import { slugError, slugify } from "@/lib/slug";
import { btnGhost, btnPrimary, field, hint, label } from "@/lib/styles";
import type { Business, BusinessInput } from "@/lib/types";
import { businessUrl } from "@/lib/urls";
import { googleReviewUrlError, isEmail, safeAccent } from "@/lib/validation";

const empty: BusinessInput = {
  name: "",
  slug: "",
  description: "",
  feedbackEmail: "",
  googleReviewUrl: "",
  welcomeMessage: DEFAULT_WELCOME,
  thankYouMessage: DEFAULT_THANKS,
  accentColour: DEFAULT_ACCENT,
};

function inputFromBusiness(business: Business): BusinessInput {
  return {
    name: business.name,
    slug: business.slug,
    description: business.description ?? "",
    feedbackEmail: business.pending_feedback_email || business.feedback_email || "",
    googleReviewUrl: business.google_review_url,
    welcomeMessage: business.welcome_message,
    thankYouMessage: business.thank_you_message,
    accentColour: business.accent_colour,
  };
}

export function BusinessFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Business | null>(null);
  const [form, setForm] = useState<BusinessInput>(empty);
  const [slugEdited, setSlugEdited] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) return;
    getBusiness(id)
      .then((business) => {
        if (!business) {
          setError("That business could not be found.");
          return;
        }
        setExisting(business);
        setForm(inputFromBusiness(business));
        setSlugEdited(true);
        if (business.status === "active") setPublishedUrl(businessUrl(business.slug));
      })
      .catch((caught) => setError(saveError(caught)))
      .finally(() => setLoading(false));
  }, [id]);

  function update<K extends keyof BusinessInput>(key: K, value: BusinessInput[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !slugEdited) next.slug = slugify(String(value));
      return next;
    });
  }

  function validate(): string | null {
    if (!form.name.trim() || form.name.trim().length > LIMITS.name) return "Enter the business name.";
    const slugProblem = slugError(form.slug.trim());
    if (slugProblem) return slugProblem;
    const reviewProblem = googleReviewUrlError(form.googleReviewUrl);
    if (reviewProblem) return reviewProblem;
    if (!isEmail(form.feedbackEmail.trim())) return "Enter a valid private feedback email.";
    if (form.description.length > LIMITS.description) return "The description is too long.";
    if (!form.welcomeMessage.trim() || form.welcomeMessage.length > LIMITS.welcome) return "Enter a shorter welcome message.";
    if (!form.thankYouMessage.trim() || form.thankYouMessage.length > LIMITS.thanks) return "Enter a shorter thank-you message.";
    if (logo) return logoFileError(logo);
    return null;
  }

  async function save(mode: SaveMode | "keep") {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    setEmailWarning(null);
    setPublishedUrl(null);
    try {
      const result = existing
        ? await updateBusiness(existing, { ...form, accentColour: safeAccent(form.accentColour) }, logo, mode)
        : await createBusiness({ ...form, accentColour: safeAccent(form.accentColour) }, logo, mode === "keep" ? "draft" : mode);
      setExisting(result.business);
      setEmailWarning(result.emailWarning);
      if (result.published) setPublishedUrl(businessUrl(result.business.slug));
      else if (mode === "draft") setError(null);
      if (!id) navigate(`/admin/businesses/${result.business.id}`, { replace: true });
    } catch (caught) {
      setError(saveError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await save(existing ? "keep" : "active");
  }

  async function resend() {
    if (!existing) return;
    setBusy(true);
    setEmailWarning(await resendVerification(existing.id));
    setBusy(false);
  }

  async function copy() {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
  }

  if (loading) return <p>Loading…</p>;

  const emailState = existing?.feedback_email_verified
    ? `Verified: ${existing.feedback_email}`
    : existing?.pending_feedback_email
      ? `Waiting for ${existing.pending_feedback_email} to confirm the verification email.`
      : "Verification is required before private feedback can be delivered.";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <h1 className="text-3xl font-semibold">{existing ? "Edit business" : "Add business"}</h1>
          <p className="mt-1 text-sm text-muted">One form publishes the review page. The NFC card keeps the same link.</p>
        </div>
        <label className={label}>
          Business name
          <input className={`${field} mt-1.5`} maxLength={LIMITS.name} value={form.name} onChange={(event) => update("name", event.target.value)} required />
        </label>
        <label className={label}>
          Page address
          <input
            className={`${field} mt-1.5`}
            value={form.slug}
            onChange={(event) => {
              setSlugEdited(true);
              update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
            }}
            onBlur={() => setForm((current) => ({ ...current, slug: slugify(current.slug) }))}
            required
          />
          <span className={hint}>{form.slug ? businessUrl(form.slug) : "Generated from the business name. It stays the same after publication unless you change it."}</span>
        </label>
        <label className={label}>
          Google review URL
          <input className={`${field} mt-1.5`} inputMode="url" placeholder="https://search.google.com/local/writereview?placeid=…" value={form.googleReviewUrl} onChange={(event) => update("googleReviewUrl", event.target.value)} required />
          <span className={hint}>Use the business’s own Google review link. Customers finish the review on Google.</span>
        </label>
        <label className={label}>
          Private feedback email
          <input className={`${field} mt-1.5`} type="email" value={form.feedbackEmail} onChange={(event) => update("feedbackEmail", event.target.value)} required />
          <span className={hint}>{emailState} The email provider processes messages for delivery. Syntrex does not store them.</span>
        </label>
        {existing?.pending_feedback_email && !existing.feedback_email_verified ? (
          <button className={btnGhost} type="button" disabled={busy} onClick={resend}>
            Resend verification email
          </button>
        ) : null}
        <label className={label}>
          Logo
          <input
            className={`${field} mt-1.5`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
          />
          <span className={hint}>PNG, JPG, or WebP. SVG files are not accepted.</span>
        </label>
        <label className={label}>
          Description
          <textarea className={`${field} mt-1.5 min-h-24`} maxLength={LIMITS.description} value={form.description} onChange={(event) => update("description", event.target.value)} />
        </label>
        <label className={label}>
          Welcome message
          <input className={`${field} mt-1.5`} maxLength={LIMITS.welcome} value={form.welcomeMessage} onChange={(event) => update("welcomeMessage", event.target.value)} />
        </label>
        <label className={label}>
          Thank-you message
          <input className={`${field} mt-1.5`} maxLength={LIMITS.thanks} value={form.thankYouMessage} onChange={(event) => update("thankYouMessage", event.target.value)} />
        </label>
        <label className={label}>
          Accent colour
          <input className="mt-1.5 h-11 w-24 bg-transparent" type="color" value={safeAccent(form.accentColour)} onChange={(event) => update("accentColour", event.target.value)} />
        </label>
        {error ? <p className="text-sm text-bad">{error}</p> : null}
        {emailWarning ? <p className="text-sm text-bad">{emailWarning}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={busy} type="submit">
            {busy ? "Saving…" : existing ? "Save" : "Create & Publish"}
          </button>
          {existing && existing.status !== "active" ? (
            <button className={btnPrimary} disabled={busy} type="button" onClick={() => save("active")}>
              Create & Publish
            </button>
          ) : null}
          <button className={btnGhost} disabled={busy} type="button" onClick={() => save("draft")}>
            Save draft
          </button>
          <Link className={btnGhost} to="/admin/businesses">
            Cancel
          </Link>
        </div>
        {existing?.status === "active" ? (
          <p className="text-sm text-muted">Saving keeps this page published at the same address.</p>
        ) : null}
      </form>
      <aside className="h-fit rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">NFC card</h2>
        {publishedUrl ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="break-all text-accent">{publishedUrl}</p>
            <p className="text-good">The public page was verified. This is the link to write on the card.</p>
            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary} type="button" onClick={copy}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className={btnGhost} href={publishedUrl} target="_blank" rel="noreferrer">
                Open page
              </a>
            </div>
            <QrCard url={publishedUrl} slug={existing?.slug ?? form.slug} />
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Open NFC Tools on your phone.</li>
              <li>Select Write.</li>
              <li>Add a URL/URI record.</li>
              <li>Paste the business’s review URL.</li>
              <li>Write the URL to the NFC card.</li>
              <li>Test the card using another phone.</li>
            </ol>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">Publish the page before copying a link onto an NFC card. Draft and disabled pages are not written to cards.</p>
        )}
      </aside>
    </div>
  );
}

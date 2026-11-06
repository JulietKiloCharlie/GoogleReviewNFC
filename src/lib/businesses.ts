import { readableError } from "./errors";
import { optimiseLogo } from "./logo";
import { requireClient } from "./supabase";
import type { Business, BusinessInput, PublicPage } from "./types";

export type SaveMode = "draft" | "active";

export type SaveResult = {
  business: Business;
  published: boolean;
  emailWarning: string | null;
};

function payload(input: BusinessInput) {
  return {
    name: input.name.trim(),
    slug: input.slug.trim(),
    description: input.description.trim() || null,
    address: input.address.trim() || null,
    google_place_id: input.googlePlaceId.trim() || null,
    google_maps_url: input.googleMapsUrl.trim() || null,
    google_review_url: input.googleReviewUrl.trim(),
    welcome_message: input.welcomeMessage.trim(),
    thank_you_message: input.thankYouMessage.trim(),
    accent_colour: input.accentColour,
  };
}

async function uploadLogo(businessId: string, file: File): Promise<string> {
  const client = requireClient();
  const blob = await optimiseLogo(file);
  const path = `${businessId}/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage.from("logos").upload(path, blob, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function fetchPublicPage(slug: string): Promise<PublicPage | null> {
  const client = requireClient();
  const { data, error } = await client.rpc("get_public_page", { page_slug: slug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicPage | undefined) ?? null;
}

export async function resendVerification(businessId: string): Promise<string | null> {
  const client = requireClient();
  const { data, error } = await client.rpc("request_feedback_inbox_confirmation", {
    target_business: businessId,
  });
  if (error) return "The page was saved, but the confirmation email could not be sent.";
  if (data && typeof data === "object" && "ok" in data && data.ok === false) {
    return "error" in data && typeof data.error === "string"
      ? data.error
      : "The confirmation email could not be sent.";
  }
  return null;
}

async function syncFeedbackEmail(business: Business, nextEmail: string): Promise<string | null> {
  const client = requireClient();
  const email = nextEmail.trim().toLowerCase();
  if (!email) return null;
  if (business.pending_feedback_email === email || (business.feedback_email === email && business.feedback_email_verified)) {
    return null;
  }

  const { error } = await client
    .from("businesses")
    .update({
      pending_feedback_email: email,
      feedback_email_verified: business.feedback_email === email ? business.feedback_email_verified : false,
    })
    .eq("id", business.id);
  if (error) throw error;
  return resendVerification(business.id);
}

async function publishIfRequested(business: Business, mode: SaveMode, fallback: Business["status"]): Promise<boolean> {
  if (mode !== "active") return false;
  const client = requireClient();
  const { error } = await client.from("businesses").update({ status: "active" }).eq("id", business.id);
  if (error) throw error;
  const page = await fetchPublicPage(business.slug);
  if (!page || page.page_status !== "active" || page.slug !== business.slug) {
    await client.from("businesses").update({ status: fallback }).eq("id", business.id);
    throw new Error("The public page could not be verified, so the business was not published.");
  }
  return true;
}

export async function createBusiness(input: BusinessInput, logo: File | null, mode: SaveMode): Promise<SaveResult> {
  const client = requireClient();
  const { data, error } = await client
    .from("businesses")
    .insert({
      ...payload(input),
      status: "draft",
      feedback_email: null,
      feedback_email_verified: false,
      pending_feedback_email: null,
    })
    .select("*")
    .single();
  if (error) throw error;

  let business = data as Business;
  if (logo) {
    const logoPath = await uploadLogo(business.id, logo);
    const { data: updated, error: logoError } = await client
      .from("businesses")
      .update({ logo_path: logoPath })
      .eq("id", business.id)
      .select("*")
      .single();
    if (logoError) throw logoError;
    business = updated as Business;
  }

  const emailWarning = await syncFeedbackEmail(business, input.feedbackEmail);
  const published = await publishIfRequested(business, mode, "draft");
  const { data: fresh, error: freshError } = await client.from("businesses").select("*").eq("id", business.id).single();
  if (freshError) throw freshError;
  return { business: fresh as Business, published, emailWarning };
}

export async function updateBusiness(
  existing: Business,
  input: BusinessInput,
  logo: File | null,
  mode: SaveMode | "keep",
): Promise<SaveResult> {
  const client = requireClient();
  let logoPath = existing.logo_path;
  if (logo) logoPath = await uploadLogo(existing.id, logo);

  const nextStatus = mode === "keep" ? existing.status : mode === "active" ? existing.status : "draft";
  const { data, error } = await client
    .from("businesses")
    .update({ ...payload(input), logo_path: logoPath, status: nextStatus === "active" ? "draft" : nextStatus })
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw error;

  if (existing.slug !== input.slug) {
    const { error: redirectError } = await client.from("slug_redirects").insert({
      slug: existing.slug,
      business_id: existing.id,
    });
    if (redirectError && redirectError.code !== "23505") throw redirectError;
  }

  let business = data as Business;
  const emailWarning = await syncFeedbackEmail(business, input.feedbackEmail);
  const shouldPublish = mode === "active" || (mode === "keep" && existing.status === "active");
  const published = await publishIfRequested(business, shouldPublish ? "active" : "draft", existing.status);
  const { data: fresh, error: freshError } = await client.from("businesses").select("*").eq("id", business.id).single();
  if (freshError) throw freshError;
  business = fresh as Business;
  return { business, published, emailWarning };
}

export async function setBusinessStatus(business: Business, status: "active" | "disabled"): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("businesses").update({ status }).eq("id", business.id);
  if (error) throw error;
  if (status === "active") {
    const page = await fetchPublicPage(business.slug);
    if (!page || page.page_status !== "active") {
      await client.from("businesses").update({ status: business.status }).eq("id", business.id);
      throw new Error("The public page could not be verified, so the status was not changed.");
    }
  }
}

export async function deleteBusiness(business: Business): Promise<void> {
  const client = requireClient();
  if (business.logo_path) {
    await client.storage.from("logos").remove([business.logo_path]);
  }
  const { error } = await client.from("businesses").delete().eq("id", business.id);
  if (error) throw error;
}

export async function listBusinesses(): Promise<Business[]> {
  const client = requireClient();
  const { data, error } = await client.from("businesses").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Business[];
}

export async function getBusiness(id: string): Promise<Business | null> {
  const client = requireClient();
  const { data, error } = await client.from("businesses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Business | null) ?? null;
}

export function saveError(error: unknown): string {
  return readableError(error);
}

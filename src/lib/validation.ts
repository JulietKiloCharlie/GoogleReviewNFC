import { LIMITS } from "./constants";

const GOOGLE_REVIEW_PATTERNS = [
  /^https:\/\/search\.google\.com\/local\/writereview(?:[/?#].*)?$/,
  /^https:\/\/g\.page\/.+$/,
  /^https:\/\/maps\.app\.goo\.gl\/.+$/,
  /^https:\/\/(?:www\.)?google\.[a-z.]{2,20}\/maps.+$/,
  /^https:\/\/maps\.google\.[a-z.]{2,20}\/.+$/,
];

export function isEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const PLACE_ID = /^[A-Za-z0-9_-]{8,255}$/;
const MAPS_URL = [
  /^https:\/\/maps\.app\.goo\.gl\/.+$/,
  /^https:\/\/maps\.google\.[a-z.]{2,20}\/.+$/,
  /^https:\/\/(?:www\.)?google\.[a-z.]{2,20}\/maps.+$/,
];

export function placeIdError(value: string): string | null {
  const id = value.trim();
  if (!id) return null;
  if (!PLACE_ID.test(id)) return "The Google Place ID from that listing could not be used.";
  return null;
}

export function acceptableMapsUrl(value: string): string {
  const url = value.trim();
  if (!url || url.length > 500 || /\s/.test(url)) return "";
  return MAPS_URL.some((pattern) => pattern.test(url)) ? url : "";
}

export function googleReviewUrlError(value: string): string | null {
  const url = value.trim();
  if (!url) return "Enter the Google review link.";
  if (url.length > 500 || /\s|@/.test(url)) return "Enter a valid HTTPS Google review link.";
  if (!GOOGLE_REVIEW_PATTERNS.some((pattern) => pattern.test(url))) {
    return "Use a Google review link, such as a g.page review link or a Google Maps write-review link.";
  }
  return null;
}

export function safeAccent(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#d7c4a3";
}

export function messageError(value: string): string | null {
  const message = value.trim();
  if (!message) return "Enter the feedback.";
  if (message.length > LIMITS.message) return "The feedback is too long.";
  return null;
}

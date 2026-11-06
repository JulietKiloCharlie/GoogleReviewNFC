import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { LIMITS } from "./constants";
import { acceptableMapsUrl, googleReviewUrlError, placeIdError } from "./validation";

export type GoogleListing = {
  placeId: string;
  name: string;
  address: string;
  reviewUrl: string;
  mapsUrl: string;
};

export type PlaceHit = {
  placeId: string;
  name: string;
  address: string;
  prediction: google.maps.places.PlacePrediction;
};

type PlacesLibrary = google.maps.PlacesLibrary;

let placesPromise: Promise<PlacesLibrary> | null = null;

export function googleMapsKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
}

export function reviewUrlForPlace(placeId: string, officialUrl?: string | null): string {
  const official = (officialUrl ?? "").trim();
  if (official && googleReviewUrlError(official) === null) return official;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function mapsUrlForPlace(placeId: string): string {
  return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(placeId)}`;
}

export function listingFromPlaceId(placeId: string): GoogleListing {
  return {
    placeId,
    name: "",
    address: "",
    reviewUrl: reviewUrlForPlace(placeId, null),
    mapsUrl: mapsUrlForPlace(placeId),
  };
}

export function listingReplacements(
  current: { name: string; address: string; googleReviewUrl: string; googleMapsUrl: string },
  listing: GoogleListing,
): string[] {
  const changes: string[] = [];
  if (listing.name && current.name.trim() && current.name.trim() !== listing.name) changes.push("business name");
  if (listing.address && current.address.trim() && current.address.trim() !== listing.address) changes.push("address");
  if (current.googleReviewUrl.trim() && current.googleReviewUrl.trim() !== listing.reviewUrl) changes.push("Google review link");
  if (listing.mapsUrl && current.googleMapsUrl.trim() && current.googleMapsUrl.trim() !== listing.mapsUrl) changes.push("Google Maps link");
  return changes;
}

export function placesErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "missing-key") return "Google search is not configured yet. Paste a review link below.";
  if (message.startsWith("Google did not") || message.startsWith("A review link")) return message;
  if (/referer|ApiNotActivatedMapError|REQUEST_DENIED|not authorized|ApiTargetBlocked/i.test(message)) {
    return "Google rejected the search key for this website. Check the key restrictions, then try again or paste a review link.";
  }
  if (/OVER_QUERY_LIMIT|quota|billing/i.test(message)) {
    return "Google search is unavailable right now. Paste a review link, or try again later.";
  }
  return "Google search could not be completed. Try again, or paste a review link.";
}

export function loadPlaces(): Promise<PlacesLibrary> {
  if (!googleMapsKey()) return Promise.reject(new Error("missing-key"));
  if (!placesPromise) {
    setOptions({ key: googleMapsKey(), v: "weekly" });
    placesPromise = importLibrary("places").catch((error: unknown) => {
      placesPromise = null;
      throw error;
    });
  }
  return placesPromise;
}

export async function searchBusinesses(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
): Promise<PlaceHit[]> {
  const places = await loadPlaces();
  const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    language: "en",
    region: "ie",
  });
  return suggestions
    .flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction) return [];
      const placeId = prediction.placeId?.trim() ?? "";
      if (placeIdError(placeId)) return [];
      return [
        {
          placeId,
          name: prediction.mainText?.text?.trim() || prediction.text?.text?.trim() || "Google listing",
          address: prediction.secondaryText?.text?.trim() ?? "",
          prediction,
        },
      ];
    })
    .slice(0, 8);
}

export async function listingFromPrediction(prediction: google.maps.places.PlacePrediction): Promise<GoogleListing> {
  const place = prediction.toPlace();
  let name = prediction.mainText?.text?.trim() ?? "";
  let address = prediction.secondaryText?.text?.trim() ?? "";
  let official: string | null = null;
  let mapsUrl = "";
  try {
    await place.fetchFields({
      fields: ["id", "displayName", "formattedAddress", "googleMapsURI", "googleMapsLinks"],
    });
    name = place.displayName?.trim() || name;
    address = place.formattedAddress?.trim() || address;
    official = place.googleMapsLinks?.writeAReviewURI ?? null;
    mapsUrl = acceptableMapsUrl(place.googleMapsURI || place.googleMapsLinks?.placeURI || "");
  } catch {
    // The suggestion still identifies the place, so the review link can be built from its Place ID.
  }

  let loadedId = "";
  try {
    loadedId = place.id || "";
  } catch {
    loadedId = "";
  }
  const placeId = (loadedId || prediction.placeId || "").trim();
  if (!placeId || placeIdError(placeId)) {
    throw new Error("Google did not return a Place ID for that listing. Paste the review link below.");
  }
  const reviewUrl = reviewUrlForPlace(placeId, official);
  if (googleReviewUrlError(reviewUrl)) {
    throw new Error("A review link could not be created for that listing. Paste the Google review link below.");
  }
  return {
    placeId,
    name: name.slice(0, LIMITS.name),
    address: address.slice(0, LIMITS.address),
    reviewUrl,
    mapsUrl: mapsUrl || mapsUrlForPlace(placeId),
  };
}

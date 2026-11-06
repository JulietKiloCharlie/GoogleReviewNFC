import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nextSlug, slugError, slugify } from "../src/lib/slug";
import { reviewPanels } from "../src/lib/rating";
import { listingFromPlaceId, listingReplacements, mapsUrlForPlace, reviewUrlForPlace } from "../src/lib/googlePlaces";
import { acceptableMapsUrl, googleReviewUrlError, isEmail, messageError, placeIdError } from "../src/lib/validation";

describe("slugs", () => {
  it("turns a business name into a stable page address", () => {
    expect(slugify("Dublin Coffee House")).toBe("dublin-coffee-house");
  });

  it("rejects reserved and malformed addresses", () => {
    expect(slugError("admin")).toMatch(/reserved/i);
    expect(slugError("Dublin Coffee")).toMatch(/lowercase/i);
    expect(slugError("dublin-coffee-house")).toBeNull();
  });

  it("avoids duplicate addresses", () => {
    expect(nextSlug("dublin-coffee-house", new Set(["dublin-coffee-house"]))).toBe("dublin-coffee-house-2");
  });
});

describe("review links and ratings", () => {
  it("accepts common Google review destinations", () => {
    expect(googleReviewUrlError("https://search.google.com/local/writereview?placeid=abc")).toBeNull();
    expect(googleReviewUrlError("https://g.page/r/example/review")).toBeNull();
    expect(googleReviewUrlError("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(googleReviewUrlError("https://www.google.ie/maps/place/Dublin")).toBeNull();
  });

  it("rejects links that are not Google review destinations", () => {
    expect(googleReviewUrlError("http://g.page/r/example/review")).toBeTruthy();
    expect(googleReviewUrlError("https://example.com/review")).toBeTruthy();
    expect(googleReviewUrlError("https://accounts.google.com/signin")).toBeTruthy();
  });

  it("sends three stars or more straight to Google", () => {
    expect(reviewPanels(1)).toEqual({ primary: "feedback", secondary: "google" });
    expect(reviewPanels(2)).toEqual({ primary: "feedback", secondary: "google" });
    expect(reviewPanels(3)).toEqual({ primary: "google", secondary: null });
    expect(reviewPanels(5)).toEqual({ primary: "google", secondary: null });
    expect(reviewPanels(0)).toBeNull();
  });

  it("builds a review link from a Google Place ID", () => {
    const placeId = "ChIJ-etyEK8NZ0gRPQ_GP31lFw0";
    const generated = `https://search.google.com/local/writereview?placeid=${placeId}`;
    expect(reviewUrlForPlace(placeId, null)).toBe(generated);
    expect(reviewUrlForPlace(placeId, "https://example.com/review")).toBe(generated);
    expect(reviewUrlForPlace(placeId, "https://g.page/r/coffee/review")).toBe("https://g.page/r/coffee/review");
    expect(mapsUrlForPlace(placeId)).toBe(`https://www.google.com/maps/search/?api=1&query_place_id=${placeId}`);
    expect(listingFromPlaceId(placeId).reviewUrl).toBe(generated);
    expect(googleReviewUrlError(reviewUrlForPlace(placeId, null))).toBeNull();
    expect(placeIdError(placeId)).toBeNull();
    expect(placeIdError("")).toBeNull();
    expect(placeIdError("not a place")).toBeTruthy();
    expect(acceptableMapsUrl("https://www.google.com/maps/place/Dublin")).toContain("google.com/maps");
    expect(acceptableMapsUrl("https://example.com/maps")).toBe("");
  });

  it("asks before replacing details the administrator already typed", () => {
    const listing = {
      placeId: "ChIJgaAzvKQPZ0gRreM8GOCkdDE",
      name: "The Coffee Drop",
      address: "72B Shantalla Rd, Dublin",
      reviewUrl: "https://search.google.com/local/writereview?placeid=ChIJgaAzvKQPZ0gRreM8GOCkdDE",
      mapsUrl: "https://www.google.com/maps/place/The+Coffee+Drop",
    };
    expect(listingReplacements({ name: "", address: "", googleReviewUrl: "", googleMapsUrl: "" }, listing)).toEqual([]);
    expect(
      listingReplacements(
        { name: "Test cafe", address: "Old address", googleReviewUrl: "https://g.page/r/old/review", googleMapsUrl: "" },
        listing,
      ),
    ).toEqual(["business name", "address", "Google review link"]);
  });

  it("checks email and feedback text", () => {
    expect(isEmail("owner@cafe.ie")).toBe(true);
    expect(isEmail("not-an-email")).toBe(false);
    expect(messageError("   ")).toBeTruthy();
    expect(messageError("The coffee was cold.")).toBeNull();
  });
});

describe("database migration", () => {
  const sql = readFileSync("supabase/migrations/20261106170000_init.sql", "utf8");

  it("enables row-level security and does not store customer feedback", () => {
    expect(sql.match(/enable row level security/g)?.length).toBe(5);
    expect(sql.toLowerCase()).not.toContain("feedback_messages");
    expect(sql).toContain("Customer feedback messages are intentionally not stored");
  });

  it("does not return private fields from the public page function", () => {
    const start = sql.indexOf("function public.get_public_page");
    const end = sql.indexOf("revoke all on function public.get_public_page");
    const body = sql.slice(start, end);
    expect(body).not.toContain("feedback_email");
    expect(body).toContain("page_status");
  });
});

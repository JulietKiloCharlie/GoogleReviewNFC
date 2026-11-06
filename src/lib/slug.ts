import { LIMITS, RESERVED_SLUGS } from "./constants";

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, LIMITS.slug)
    .replace(/-+$/g, "");

  return slug;
}

export function slugError(slug: string): string | null {
  if (!slug) return "Enter a page address.";
  if (slug.length > LIMITS.slug) return "The page address is too long.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers, and single hyphens.";
  }
  if (RESERVED_SLUGS.has(slug)) return "That page address is reserved.";
  return null;
}

export function nextSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const trimmed = base.slice(0, LIMITS.slug - suffix.length).replace(/-+$/g, "");
    const candidate = `${trimmed}${suffix}`;
    if (!taken.has(candidate) && !RESERVED_SLUGS.has(candidate)) return candidate;
  }
  return base;
}

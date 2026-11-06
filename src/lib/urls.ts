export function publicSiteOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function businessUrl(slug: string): string {
  return `${publicSiteOrigin()}/${slug}`;
}

export function logoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  if (!base || !/^[A-Za-z0-9][A-Za-z0-9/_-]{0,180}\.(png|jpe?g|webp)$/.test(path)) return null;
  return `${base}/storage/v1/object/public/logos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// Javni URL stranice za linkove u emailovima (potvrda, reset lozinke) i affiliate linkove.
// Postavi NEXT_PUBLIC_SITE_URL u Vercelu (npr. https://garaza.gg) da linkovi nikad ne vode na preview deployment.
export function siteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  return typeof window !== "undefined" ? window.location.origin : "";
}

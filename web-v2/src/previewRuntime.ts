/** Isolated raw.githack preview transport + hash routes. Default app remains unchanged. */
export const isGitHackPreview = import.meta.env.VITE_BINRAT_GITHACK_PREVIEW === "1";
export const previewApiOrigin = "https://binrat-journey-preview.pettevik.workers.dev";
export function publicApiUrl(path: string): string {
  if (!/^\/api\/[a-z0-9/_-]+$/i.test(path)) throw new Error("PUBLIC_API_PATH_INVALID");
  return (isGitHackPreview ? previewApiOrigin : "") + path;
}
export function routeHref(path: string): string {
  if (!path.startsWith("/") || path.includes("#") || path.includes("?"))
    throw new Error("ROUTE_PATH_INVALID");
  if (isGitHackPreview) return window.location.pathname + window.location.search + "#" + path;
  const base = import.meta.env.BASE_URL === "/" ? "" : import.meta.env.BASE_URL.replace(/\/$/, "");
  return base + path + window.location.search;
}
export function shareableRouteUrl(path: string): string {
  return window.location.origin + routeHref(path);
}
export function sourceSwitchHref(live: boolean): string {
  return window.location.pathname + (live ? "?source=live" : "") +
    (isGitHackPreview ? window.location.hash : "");
}

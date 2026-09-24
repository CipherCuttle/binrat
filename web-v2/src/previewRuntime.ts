/** Isolated raw.githack preview transport + hash routes. Default app remains unchanged. */
declare const __BINRAT_GITHACK_PREVIEW__: boolean;
declare const __BINRAT_VITE_BASE__: string;
export const isGitHackPreview = typeof __BINRAT_GITHACK_PREVIEW__ !== "undefined" && __BINRAT_GITHACK_PREVIEW__;
export const previewApiOrigin = "https://binrat-githack-proxy-v2.onrender.com";
export function publicApiUrl(path: string): string {
  if (!/^\/api\/[a-z0-9/_-]+$/i.test(path)) throw new Error("PUBLIC_API_PATH_INVALID");
  return (isGitHackPreview ? previewApiOrigin : "") + path;
}
export function routeHref(path: string): string {
  if (!path.startsWith("/") || path.includes("#") || path.includes("?"))
    throw new Error("ROUTE_PATH_INVALID");
  if (isGitHackPreview) return window.location.pathname + window.location.search + "#" + path;
  const viteBase = typeof __BINRAT_VITE_BASE__ !== "undefined" ? __BINRAT_VITE_BASE__ : "/";
  const base = viteBase === "/" ? "" : viteBase.replace(/\/$/, "");
  return base + path + window.location.search;
}
export function shareableRouteUrl(path: string): string {
  return window.location.origin + routeHref(path);
}
export function sourceSwitchHref(live: boolean): string {
  return window.location.pathname + (live ? "?source=live" : "") +
    (isGitHackPreview ? window.location.hash : "");
}

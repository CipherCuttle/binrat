/** BINRAT source-scoped micrographics. Pure presentational SVGs, never signals. */
export function ProofThread({ ids }: { ids: readonly string[] }) {
  // A connecting line appears only for >=2 distinct already-confirmed Case IDs.
  const nodes = [...new Set(ids)].slice(0, 4);
  if (nodes.length < 2) return null;
  return <svg className="inv-proof-thread" width="54" height="17" viewBox="0 0 54 17"
    aria-hidden="true" focusable="false">
    <path d="M9 8.5 H45" stroke="#95dcd4" strokeWidth="1.25" strokeDasharray="2.5 3" opacity=".8" />
    <circle cx="9" cy="8.5" r="3.25" stroke="#98e5dc" strokeWidth="1.4" fill="#1b353a" />
    <circle cx="45" cy="8.5" r="3.25" stroke="#98e5dc" strokeWidth="1.4" fill="#1b353a" />
    {nodes.length > 2 && <circle cx="27" cy="8.5" r="2" fill="#b3d4e0" />}
  </svg>;
}

/** Pure, stable decorative identity for the approved eight V2 archetypes.
 * Hash the Pons token address, never the Case ID or reported deployer. */
export function getCaseSplashVariant(address: string): number | null {
  const normalized = address.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized) && !/^[0-9a-f]{64}$/.test(normalized)) return null;
  let hash = 0x811c9dc5;
  for (const ch of normalized) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return hash % 8;
}

/** One address-to-art presentation path for FIND, TRAILS, and the Case header.
 * The artwork is cosmetic only; it is not an identity/risk/source signal. */
export function CaseSplashArt({ address, presentation = "thumbnail" }: {
  address: string; presentation?: "thumbnail" | "hero";
}) {
  const variant = getCaseSplashVariant(address);
  if (variant === null) return null;
  const column = variant % 4;
  const row = Math.floor(variant / 4);
  return <span className={presentation === "hero" ? "inv-case-splash inv-case-splash-hero" : "inv-case-sigil inv-case-splash"}
    data-splash-variant={variant} aria-hidden="true" style={{
      display: "block",
      flexShrink: 0,
      backgroundColor: "#050505",
      backgroundImage: `url('${import.meta.env.BASE_URL}case-splash-sprite.webp')`,
      backgroundSize: "400% 200%",
      backgroundRepeat: "no-repeat",
      backgroundPosition: `${column * 100 / 3}% ${row * 100}%`,
      borderRadius: presentation === "hero" ? "inherit" : "4px",
    }} />;
}

/** Legacy public name retained for the FIND / TRAILS thumbnail. */
export function CaseSigil({ id }: { id: string }) {
  return <CaseSplashArt address={id} />;
}

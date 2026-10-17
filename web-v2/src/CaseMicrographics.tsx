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

/** Eight approved trash-art crops; decorative only, not a risk or identity signal.
 * Stable address-hash assignment avoids flicker and per-render randomness.
 * The sprite is copied by Vite from web/assets, never fetched from an API. */
export function CaseSigil({ id }: { id: string }) {
  const address = id.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address) && !/^[0-9a-f]{64}$/.test(address)) return null;
  let hash = 0x811c9dc5;
  for (const ch of address) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  const variant = hash % 8;
  const column = variant % 4;
  const row = Math.floor(variant / 4);
  return <span className="inv-case-sigil inv-case-splash" data-splash-variant={variant}
    aria-hidden="true" style={{
      display: 'block',
      flexShrink: 0,
      backgroundColor: '#050505',
      backgroundImage: "url('/case-splash-sprite.webp')",
      backgroundSize: '400% 200%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `${column * 100 / 3}% ${row * 100}%`,
      borderRadius: '4px',
    }} />;
}

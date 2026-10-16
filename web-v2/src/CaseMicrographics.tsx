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

/** Deterministic per-Case graphic. Hash bits give a visual ID, not a risk score. */
export function CaseSigil({ id }: { id: string }) {
  if (!/^[0-9a-f]{64}$/.test(id)) return null;
  const cells: {x:number;y:number}[]=[];
  for(let y=0;y<4;y++) for(let x=0;x<2;x++) {
    const bit=parseInt(id[y*2+x],16)%2;
    if(bit) {
      cells.push({x:x+0.5,y:y+0.5},{x:3-x+0.5,y:y+0.5});
    }
  }
  return <svg className="inv-case-sigil" viewBox="0 0 26 26" width="26" height="26"
      aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="24" height="24" rx="4" fill="#26283c" stroke="#697d84" strokeWidth="0.7"/>
      {cells.map((p,i)=><rect key={i} x={5+p.x*3.7} y={5+p.y*3.7} width="2.75" height="2.75" rx=".35" fill="#b7e8de"/>)}
    </svg>;
}

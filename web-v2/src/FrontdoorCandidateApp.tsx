import { useEffect, useState } from 'react';
import { PonsCasePreview } from './PonsCasePreview';
import { VisualLab } from './VisualLab';

/**
 * Pure presentation candidate. All evidence comes from the existing same-origin
 * Pons API, not from the historical ARC 5042 Product Surface V2.
 * No API proxy is part of the compiled static artifact.
 */
function currentLocation() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const query = new URLSearchParams(window.location.search);
  return { path, synthetic: path === '/visual-lab', ponsPreview: query.get('ponsPreview') === '1' };
}
export default function FrontdoorCandidateApp() {
  const [loc, setLoc] = useState(currentLocation);
  useEffect(() => {
    const changed = () => setLoc(currentLocation());
    window.addEventListener('popstate', changed);
    return () => window.removeEventListener('popstate', changed);
  }, []);
  if (loc.synthetic && !loc.ponsPreview) return <VisualLab />;
  if (loc.synthetic || loc.path === '/' || loc.path === '/index.html' || /^\/bag\/[0-9a-f]{64}$/.test(loc.path)) {
    return <PonsCasePreview />;
  }
  // Do not silently expose historic ARC V2 routes as live current Pons features.
  return <main id="content" className="visual-lab" style={{ minHeight: '100svh', padding: '12vh 7vw' }}>
    <span style={{ color: '#79f5ff' }}>BINRAT · PONS CASES</span>
    <h1 style={{ fontSize: 'clamp(30px, 6vw, 56px)', margin: '22px 0 12px' }}>NOT IN THIS BUILD.</h1>
    <p>This route isn't available. Rat Zero's verified Pons Cases are back at the dumpster.</p>
    <p style={{ marginTop: 30 }}><a href="/" style={{ color: '#79f5ff', textDecoration: 'underline' }}>RETURN TO PONS CASES →</a></p>
  </main>;
}

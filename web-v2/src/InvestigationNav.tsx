import type { MouseEvent } from 'react';
import type { InvestigationSection } from './investigationUX';

type Props = {
  section: InvestigationSection;
  hasCase: boolean;
  savedCount: number;
  isFresh: boolean;
  onNavigate: (path: string) => void;
  hrefForPath: (path: string) => string;
};

export function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    find: 'M3 7h18M5 7l1 13h12l1-13M8 7V4h8v3M9 11v5m6-5v5',
    trails: 'M5 4v10c0 3 2 5 5 5h8M5 10h8c3 0 5-2 5-5M2 4h6m7 1h6m-3 11v6',
    saved: 'M5 5h5l2 3h7v12H5V5Zm4 7h6m-6 4h4',
    crew: 'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9v-2c0-3 3-5 7-5s7 2 7 5v2M16 4c5 0 5 7 0 7m2 4c3 1 4 3 4 6',
    status: 'M4 16V8m5 12V4m6 12V8m5 12V4',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.find} /></svg>;
}

/** Presentation map only; source freshness and future workers stay explicit. */
export function InvestigationNav({ section, hasCase, savedCount, isFresh, onNavigate, hrefForPath }: Props) {
  const items: { name: string; path: string; label: string; detail: string }[] = [
    { name: 'find', path: '/', label: 'FIND', detail: hasCase ? 'Investigating a Case' : 'Pons launch window' },
    { name: 'trails', path: '/trails', label: 'TRAILS', detail: 'Compare deployers' },
    { name: 'saved', path: '/saved', label: 'CASEBOOK', detail: String(savedCount) + ' saved' },
    { name: 'crew', path: '/crew', label: 'CREW', detail: 'The Rats & their roles' },
    { name: 'status', path: '/status', label: 'SOURCE', detail: isFresh ? 'Publication checked' : 'Updates paused' }
  ];

  function activate(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  }

  const links = items.map((item) =>
    <a key={item.name} className={section === item.name ? 'active' : ''}
       aria-current={section === item.name ? 'page' : undefined}
       href={hrefForPath(item.path)} data-route={item.path} onClick={(e) => activate(e, item.path)}>
      <NavIcon name={item.name} /><span><strong>{item.label}</strong><small>{item.detail}</small></span>
      {item.name === 'saved' && <b className="inv-nav-count">{savedCount}</b>}
    </a>
  );
  return <>
    <aside className="inv-sidebar" aria-label="Investigation navigation">
      <a className="inv-wordmark" href={hrefForPath('/')} onClick={(e) => activate(e, '/')}><img src="/crew/rat-avatar-48.png" width={32} height={32} alt="" />BINRAT<span>®</span></a>
      <span className="inv-sidebar-kicker">CRYPTO INVESTIGATION</span>
      <span className="inv-nav-heading">YOUR WORKSPACE</span>
      <nav aria-label="Investigation">{links}</nav>
      <div className="inv-sidebar-footer">
        <div className="inv-scout-presence"><img src="/crew/rat-avatar-48.png" width={36} height={36} alt="" /><div><strong>RAT ZERO</strong><span>SCOUT · {isFresh ? 'SOURCE CHECKED' : 'SOURCE NOT FRESH'}</span></div></div>
        <small>HE GETS THE SCRAPS.<br/>YOU GET THE RECEIPTS.</small>
        <a href={hrefForPath('/crew')} onClick={(e) => activate(e, '/crew')}>TRIPWIRE · BUILDING<br/>SNIFFER · PROVING <span aria-hidden="true">↗</span></a>
      </div>
    </aside>
    <nav className="inv-mobile-nav" aria-label="Mobile investigation navigation">
      {items.map((item) =>
        <a key={item.name} href={hrefForPath(item.path)} data-route={item.path}
          aria-current={section === item.name ? 'page' : undefined}
          className={section === item.name ? 'active' : ''}
          onClick={(e) => activate(e, item.path)}><NavIcon name={item.name} /><span>{item.label}</span></a>)}
    </nav>
  </>;
}

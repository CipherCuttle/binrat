import type { MouseEvent } from 'react';
import type { InvestigationSection } from './investigationUX';

type Props = {
  section: InvestigationSection;
  hasCase: boolean;
  savedCount: number;
  isFresh: boolean;
  onNavigate: (path: string) => void;
};

/** A compact investigation map surrounding V3, never a second source of fact. */
export function InvestigationNav({ section, hasCase, savedCount, isFresh, onNavigate }: Props) {
  const items: { name: string; path: string; label: string; detail: string }[] = [
    { name: 'find', path: '/', label: 'FIND', detail: 'Fresh launches' },
    { name: 'trails', path: '/trails', label: 'TRAILS', detail: 'Earlier matches' },
    { name: 'saved', path: '/saved', label: 'CASEBOOK', detail: String(savedCount) + ' saved' },
    { name: 'crew', path: '/crew', label: 'CREW', detail: 'Meet the Rats' },
    { name: 'status', path: '/status', label: 'STATUS', detail: isFresh ? 'Source checked' : 'Check source' }
  ];

  function activate(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  }

  const links = items.map((item) =>
    <a key={item.name} className={section === item.name && !hasCase ? 'active' : ''}
       aria-current={section === item.name && !hasCase ? 'page' : undefined}
       href={item.path} onClick={(e) => activate(e, item.path)}>
      <strong>{item.label}</strong><small>{item.detail}</small>
    </a>
  );
  return <>
    <aside className="inv-sidebar" aria-label="Investigation navigation">
      <a className="inv-wordmark" href="/" onClick={(e) => activate(e, '/')}>BINRAT <span>↗</span></a>
      <span className="inv-sidebar-kicker">THE RAT REMEMBERS.</span>
      <nav aria-label="Investigation">{links}</nav>
      <div className="inv-sidebar-footer">
        <span>TRIPWIRE · BUILDING</span>
        <span>SNIFFER · PROVING</span>
        <small>DEGEN DECIDES ATTENTION.<br/>RECEIPTS DECIDE TRUTH.</small>
      </div>
    </aside>
    <nav className="inv-mobile-nav" aria-label="Mobile investigation navigation">
      {items.map((item) =>
        <a key={item.name} href={item.path}
          aria-current={section === item.name && !hasCase ? 'page' : undefined}
          className={section === item.name && !hasCase ? 'active' : ''}
          onClick={(e) => activate(e, item.path)}>{item.label}</a>)}
    </nav>
  </>;
}

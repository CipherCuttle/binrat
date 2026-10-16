import type { PonsCase } from './pons-readonly-preview.mjs';
import { groupDeployerCases, observationForFind, type CaseNotes } from './investigationUX';
import { NavIcon } from './InvestigationNav';

export const shortAddress = (value: string) => value.slice(0, 6) + '…' + value.slice(-4);
export const tokenLabel = (item: Pick<PonsCase, 'name' | 'symbol'>) => item.name.trim() || item.symbol.trim() || 'Unnamed launch';

export function FindRow({ item, onOpen, compact = false }: {
  item: PonsCase; onOpen: (id: string) => void; compact?: boolean;
}) {
  const hasName = Boolean(item.name.trim() || item.symbol.trim());
  return <button type="button" id={'find-' + item.id} data-case-id={item.id}
    aria-label={'Open Case ' + tokenLabel(item) + ' ' + shortAddress(item.token)}
    className={'vl-find inv-find-row' + (compact ? ' inv-find-compact' : '')} onClick={() => onOpen(item.id)}>
    <span className="vl-find-mark" aria-hidden="true">{item.symbol.trim().slice(0, 2) || '↗'}</span>
    <span className="a1-find-copy"><strong>{hasName ? tokenLabel(item) : shortAddress(item.token)}</strong>
      <small className="a1-token">{hasName ? (item.symbol && item.name ? item.symbol + ' · ' : '') + shortAddress(item.token) : 'Unnamed Pons launch'}</small>
    </span>
    {!compact && <span className="inv-find-history"><span className={item.priorLaunches > 0 ? 'a1-recurrence' : ''}>{observationForFind(item).label}</span><small>{observationForFind(item).action}</small><small>Deployer {shortAddress(item.reportedCreatorAddress)}</small></span>}
    <span className="a1-open">OPEN CASE <span aria-hidden="true">↗</span></span>
  </button>;
}

export function DeployerGroups({ cases, onOpen }: { cases: PonsCase[]; onOpen: (id: string) => void }) {
  return <div className="inv-deployer-grid">{groupDeployerCases(cases).map(group => <article className="inv-deployer-group" data-deployer={group.address} key={group.address}>
    <header><div><span className="vl-eyebrow">REPORTED DEPLOYER</span><h3>{shortAddress(group.address)}</h3></div><span className="inv-group-count">{group.cases.length} in this window</span></header>
    <p>Compare the launches below. Shared address; human ownership unknown.</p>
    <div className="a1-find-grid">{group.cases.slice(0, 3).map(item => <FindRow key={item.id} item={item} onOpen={onOpen} compact />)}</div>
    {group.cases.length > 3 && <details className="inv-more-cases"><summary>{group.cases.length - 3} more Cases from this address</summary><div className="a1-find-grid">{group.cases.slice(3).map(item => <FindRow key={item.id} item={item} onOpen={onOpen} compact />)}</div></details>}
  </article>)}</div>;
}

export function SavedCases({ ids, cases, notes, persistent, onOpen, onRemove, onFind, onNoteChange }: {
  ids: string[]; cases: PonsCase[]; notes: CaseNotes; persistent: boolean;
  onOpen: (id: string) => void; onRemove: (id: string) => void; onFind: () => void;
  onNoteChange: (id: string, value: string) => void;
}) {
  return <section className="inv-workbench inv-casebook" aria-labelledby="inv-saved-heading">
    <span className="vl-eyebrow">YOUR INVESTIGATIONS</span>
    <header className="inv-page-heading"><div><h1 id="inv-saved-heading">Pick up where you left off.</h1><p>Saved Case links, kept on this device. Open one to check its source again.</p></div><span className="inv-count-badge">{ids.length} SAVED</span></header>
    <div className="inv-local-note"><NavIcon name="saved" /><span>Device only · saving does not start a Watch or send alerts.</span></div>
    {!persistent && <p role="status">Device storage unavailable. This list lasts only for this session.</p>}
    {ids.length === 0 ? <div className="inv-empty-state"><NavIcon name="saved" /><h2>Keep a thread worth pulling.</h2><p>Open a find, check the Case, then hit SAVE CASE. It will be waiting here.</p><button className="vl-primary" onClick={onFind}>FIND A CASE <span aria-hidden="true">→</span></button></div> :
      <ul className="inv-saved-list">{ids.map(id => {
        const item = cases.find(c => c.id === id);
        return <li key={id}><button className="inv-saved-open" onClick={() => onOpen(id)}>
          <span className="inv-saved-icon"><NavIcon name="saved" /></span>
          <span><strong>{item ? (item.name.trim() || item.symbol.trim() ? tokenLabel(item) : shortAddress(item.token)) : 'Saved Case · ' + id.slice(0, 10) + '…'}</strong><small>{item ? 'Pons launch · ' + shortAddress(item.reportedCreatorAddress) + ' reported deployer' : 'Outside this launch window · source checked on open'}</small><code>CASE {id.slice(0, 10)}…</code></span>
          <span className="inv-saved-arrow" aria-hidden="true">↗</span>
        </button><button className="vl-utility inv-remove" onClick={() => onRemove(id)} aria-label={'Remove saved Case ' + id}>REMOVE</button>
        {item && <p className="inv-saved-evidence"><strong>Evidence:</strong> {observationForFind(item).label} · {observationForFind(item).action}. This snapshot may be stale; reopen to recheck.</p>}
        {!item && <p className="inv-saved-evidence">Outside this published window. No current evidence is shown; reopen to verify.</p>}
        <label className="inv-note-editor">YOUR PRIVATE INVESTIGATION NOTE
          <textarea aria-label={'Research note for Case ' + id} maxLength={280} rows={2}
            value={notes[id] ?? ''} placeholder="What do you want to check when you return?"
            onChange={(e) => onNoteChange(id, e.target.value)} />
          <span>{(notes[id] ?? '').length}/280 · saved on this device only</span>
        </label></li>;
      })}</ul>}
    {ids.length > 0 && <button className="vl-utility" onClick={onFind}>BACK TO FINDS <span aria-hidden="true">→</span></button>}
  </section>;
}

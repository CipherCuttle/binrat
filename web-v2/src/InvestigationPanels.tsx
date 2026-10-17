import type { PonsCase } from './pons-readonly-preview.mjs';
import { groupDeployerCases, observationForFind, type CaseNotes } from './investigationUX';
import { NavIcon } from './InvestigationNav';
import { GlareHoverButton } from './ReactBitsStarter';
import { CaseSigil } from './CaseMicrographics';

export const shortAddress = (value: string) => value.slice(0, 6) + '…' + value.slice(-4);
export const tokenLabel = (item: Pick<PonsCase, 'name' | 'symbol'>) => item.name.trim() || item.symbol.trim() || 'Unnamed launch';

export function FindRow({ item, onOpen, compact = false }: {
  item: PonsCase; onOpen: (id: string) => void; compact?: boolean;
}) {
  const hasName = Boolean(item.name.trim() || item.symbol.trim());
  return <GlareHoverButton id={'find-' + item.id} data-case-id={item.id}
    aria-label={'Open Case ' + tokenLabel(item) + ' ' + shortAddress(item.token)}
    className={'vl-find inv-find-row' + (compact ? ' inv-find-compact' : '')} onClick={() => onOpen(item.id)}>
    <span className="vl-find-mark" aria-hidden="true">{item.symbol.trim() ? item.symbol.trim().slice(0, 2) : <CaseSigil id={item.id} />}</span>
    <span className="a1-find-copy"><strong>{hasName ? tokenLabel(item) : shortAddress(item.token)}</strong>
      <small className="a1-token">{hasName ? (item.symbol && item.name ? item.symbol + ' · ' : '') + shortAddress(item.token) : 'Unnamed Pons launch'}</small>
    </span>
    {!compact && <span className="inv-find-history">
      <span className={'inv-find-observation' + (item.priorLaunches > 0 ? ' a1-recurrence' : '')}>{observationForFind(item).label}</span>
      <small className="inv-find-next">{observationForFind(item).action}</small>
      <small className="inv-find-deployer">DEPLOYER {shortAddress(item.reportedCreatorAddress)}</small>
    </span>}
    <span className="a1-open">OPEN CASE <span aria-hidden="true">↗</span></span>
  </GlareHoverButton>;
}

export function DeployerGroups({ cases, onOpen }: { cases: PonsCase[]; onOpen: (id: string) => void }) {
  const groups = groupDeployerCases(cases);
  const linked = groups.filter(group => new Set(group.cases.map(item => item.id)).size > 1);
  const single = groups.filter(group => new Set(group.cases.map(item => item.id)).size === 1);
  function renderGroup(group: typeof groups[number], linkedGroup: boolean) {
    return <article className={'inv-deployer-group' + (linkedGroup ? ' inv-deployer-linked' : ' inv-deployer-single')} data-deployer={group.address} key={group.address}>
      <header><div><span className="vl-eyebrow">{linkedGroup ? 'SHARED REPORTED ADDRESS' : 'ONE VISIBLE LAUNCH'}</span><h3>{shortAddress(group.address)}</h3></div><span className="inv-group-count">{group.cases.length} in this window</span></header>
      <p>{linkedGroup ? 'These distinct Cases report the same deployer address. Shared address does not identify a human or indicate returns.' : 'Only one Case for this address is visible here. Other activity outside this window is unknown.'}</p>
      <div className="a1-find-grid">{group.cases.slice(0,3).map(item => <FindRow key={item.id} item={item} onOpen={onOpen} compact />)}</div>
      {group.cases.length > 3 && <details className="inv-more-cases"><summary>{group.cases.length - 3} more Cases from this address</summary><div className="a1-find-grid">{group.cases.slice(3).map(item => <FindRow key={item.id} item={item} onOpen={onOpen} compact />)}</div></details>}
    </article>;
  }
  return <div className="inv-trails-layout">
    {linked.length > 0 && <section className="inv-trails-linked" aria-label="Directly comparable Cases"><div className="inv-trails-label"><span>CONNECTED CASES · CURRENT WINDOW</span><strong>{linked.length} shared-address {linked.length === 1 ? 'connection' : 'connections'}</strong></div><div className="inv-deployer-grid">{linked.map(group => renderGroup(group,true))}</div></section>}
    {single.length > 0 && <details className="inv-trails-single" open={linked.length === 0 ? true : undefined}>
      <summary>{single.length} single-address {single.length === 1 ? 'record' : 'records'} · no in-window comparison <span aria-hidden="true">↗</span></summary>
      <p className="inv-trails-scope">These launches have no second visible Case from the same reported address in this window. Earlier indexed counts may still exist outside this captured sample.</p>
      <div className="inv-deployer-grid">{single.map(group => renderGroup(group,false))}</div>
    </details>}
  </div>;
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
          <span className="inv-saved-arrow" aria-hidden="true">OPEN ↗</span>
        </button><button className="vl-utility inv-remove" onClick={() => onRemove(id)} aria-label={'Remove saved Case ' + id}>REMOVE</button>
        {item && <p className="inv-saved-evidence"><strong>Evidence:</strong> {observationForFind(item).label} · {observationForFind(item).action}. This snapshot may be stale; reopen to recheck.</p>}
        {!item && <p className="inv-saved-evidence">Outside this published window. No current evidence is shown; reopen to verify.</p>}
        <label className="inv-note-editor">YOUR PRIVATE INVESTIGATION NOTE
          <textarea aria-label={'Research note for Case ' + id} maxLength={280} rows={2}
            value={notes[id] ?? ''} placeholder="What do you want to check when you return?"
            onChange={(e) => onNoteChange(id, e.target.value)} />
          <span>{(notes[id] ?? '').length}/280 · {persistent ? 'stored on this device' : 'session only, storage unavailable'}</span>
        </label></li>;
      })}</ul>}
    {ids.length > 0 && <button className="vl-utility" onClick={onFind}>BACK TO FINDS <span aria-hidden="true">→</span></button>}
  </section>;
}

/** Pure, Pons-only presentation helpers. No authority, RPC or Watch actions. */
export type InvestigationSection = 'find' | 'trails' | 'saved' | 'crew' | 'status';
const CASE_ID = /^[0-9a-f]{64}$/;

export function sectionForPath(path: string): InvestigationSection {
  const p = path.replace(/\/$/, '') || '/';
  if (p === '/saved') return 'saved';
  if (p === '/trails') return 'trails';
  if (p === '/crew') return 'crew';
  if (p === '/status') return 'status';
  return 'find'; // exact /bag/<id> is handled by the existing Case router
}
export function readCasebook(value: string | null): string[] {
  if (!value || value.length > 8192) return [];
  try {
    const ids: unknown = JSON.parse(value);
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids.filter((id): id is string =>
      typeof id === 'string' && CASE_ID.test(id)))].slice(0, 50);
  } catch { return []; }
}
export function toggleSavedCase(current: readonly string[], id: string): string[] {
  if (!CASE_ID.test(id)) return [...current];
  return current.includes(id)
    ? current.filter((item) => item !== id)
    : [id, ...current.filter((item) => item !== id)].slice(0, 50);
}
export type DiscoverableCase = {
  name: string; symbol: string; token: string; reportedCreatorAddress: string;
  priorLaunches: number;
};
export function filterDiscoverableCases<T extends DiscoverableCase>(
  cases: readonly T[], query: string, onlyFamiliar: boolean
): T[] {
  const needle = query.trim().toLowerCase().slice(0, 128);
  return cases.filter((item) =>
    (!onlyFamiliar || item.priorLaunches > 0) &&
    (!needle || [item.name, item.symbol, item.token, item.reportedCreatorAddress]
      .some((field) => field.toLowerCase().includes(needle))));
}

/** Groups the displayed, already-verified launch window. Never searches more history. */
export function groupDeployerCases<T extends DiscoverableCase>(cases: readonly T[]): {
  address: string; cases: T[];
}[] {
  const groups = new Map<string, T[]>();
  for (const item of cases) {
    const key = item.reportedCreatorAddress;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups].map(([address, items]) => ({ address, cases: items }));
}

/** Keep modifier-click/new-tab destinations inside the same static preview. */
export function investigationHref(route: string, location: string, staticPreview: boolean): string {
  if (!staticPreview) return route;
  const url = new URL(location);
  url.searchParams.delete('view');
  url.searchParams.delete('case');
  const id = /^\/bag\/([0-9a-f]{64})$/.exec(route)?.[1];
  if (id) url.searchParams.set('case', id);
  else if (['/saved', '/trails', '/crew', '/status'].includes(route)) {
    url.searchParams.set('view', route.slice(1));
  }
  url.hash = route.includes('#') ? route.slice(route.indexOf('#')) : '';
  return url.pathname + url.search + url.hash;
}

/** A factual investigation prompt, not a risk rating or a trading signal. */
export function observationForFind(item: Pick<DiscoverableCase, 'priorLaunches'>): {
  label: string; action: string; explanation: string;
} {
  if (item.priorLaunches > 0) return {
    label: item.priorLaunches + ' earlier indexed ' + (item.priorLaunches === 1 ? 'launch' : 'launches'),
    action: 'Compare the recorded trail',
    explanation: 'Same reported deployer in partial indexed history. Human ownership and significance unknown.'
  };
  return {
    label: 'No earlier indexed match',
    action: 'Check the launch receipt',
    explanation: 'No earlier match in partial records; this does not establish a new or safe deployer.'
  };
}

export type CaseNotes = Record<string, string>;
/** User-authored device-only notes. Never treat these as verified chain observations. */
export function readCaseNotes(value: string | null): CaseNotes {
  const safe: CaseNotes = Object.create(null);
  if (!value || value.length > 20000) return safe;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return safe;
    for (const [key, note] of Object.entries(parsed)) {
      if (Object.keys(safe).length >= 50) break;
      if (CASE_ID.test(key) && typeof note === 'string' && note.length <= 280 && note.trim())
        safe[key] = note;
    }
  } catch { /* malformed device data is not trusted */ }
  return safe;
}
export function updateCaseNote(current: CaseNotes, id: string, value: string): CaseNotes {
  if (!CASE_ID.test(id)) return current;
  const next: CaseNotes = Object.assign(Object.create(null), current);
  const note = value.slice(0, 280);
  if (!note.trim()) delete next[id];
  else if (Object.hasOwn(next, id) || Object.keys(next).length < 50) next[id] = note;
  return next;
}

/** A verifiable, snapshot-scoped relationship between DISTINCT Cases, not a risk score.
 * The same reported deployer address on >=2 exact launch IDs is the only fact claimed.
 */
export function sharedDeployerLeads<T extends DiscoverableCase & { id: string }>(
  cases: readonly T[]
): { address: string; caseIds: string[] }[] {
  return groupDeployerCases(cases)
    .map(group => ({
      address: group.address,
      caseIds: [...new Set(group.cases.map(item => item.id))],
    }))
    .filter(group => group.caseIds.length >= 2);
}

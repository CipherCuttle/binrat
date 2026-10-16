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

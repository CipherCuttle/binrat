import { demoFeed, demoRadar } from './fixtures';
import type { PublicFeed, RadarWatchlist } from './types';

export type DataMode = 'DEMO' | 'LIVE';

const wantsLive = new URLSearchParams(window.location.search).get('source') === 'live';

export async function loadProductData(): Promise<{ feed: PublicFeed; radar: RadarWatchlist; mode: DataMode }> {
  if (!wantsLive) return { feed: demoFeed, radar: demoRadar, mode: 'DEMO' };
  const [feedResponse, radarResponse] = await Promise.all([
    fetch('/api/feed', { headers: { accept: 'application/json' }, cache: 'no-store' }),
    fetch('/api/rat-radar/watchlist', { headers: { accept: 'application/json' }, cache: 'no-store' })
  ]);
  if (!feedResponse.ok || !radarResponse.ok) throw new Error('PUBLIC_READ_PLANE_UNAVAILABLE');
  const feed = await feedResponse.json() as PublicFeed;
  const radar = await radarResponse.json() as RadarWatchlist;
  assertFeed(feed);
  assertRadar(radar);
  return { feed, radar, mode: 'LIVE' };
}

function assertFeed(value: PublicFeed) {
  if (value.schemaVersion !== 'binrat.public-feed/0.1' || value.chainId !== 5042 || !Array.isArray(value.bags)) {
    throw new Error('PUBLIC_FEED_SCHEMA_INVALID');
  }
}

function assertRadar(value: RadarWatchlist) {
  if (value.schemaVersion !== 'binrat.rat-radar-watchlist/0.1' || value.chainId !== 5042 || !Array.isArray(value.candidates)) {
    throw new Error('RAT_RADAR_SCHEMA_INVALID');
  }
}

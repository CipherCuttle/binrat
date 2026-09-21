import { demoFeed, demoRadar, demoRadarActivities } from './fixtures';
import type { PublicFeed, RadarPublicActivity, RadarWatchlist } from './types';

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

export async function loadRadarActivities(
  activityIds: readonly string[],
  recipient: string,
  mode: DataMode,
  signal?: AbortSignal
): Promise<RadarPublicActivity[]> {
  if (mode === 'DEMO') {
    return activityIds.map((activityId) => {
      const activity = demoRadarActivities[activityId];
      if (!activity) throw new Error('DEMO_RADAR_ACTIVITY_MISSING');
      return activity;
    });
  }
  const activities = await Promise.all(
    activityIds.map(async (activityId) => {
      const response = await fetch(`/api/rat-radar/activity/${activityId}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal
      });
      if (!response.ok) throw new Error('RADAR_ACTIVITY_PUBLIC_READ_UNAVAILABLE');
      return response.json() as Promise<RadarPublicActivity>;
    })
  );
  for (const [index, activity] of activities.entries()) {
    assertRadarActivity(activity, recipient, activityIds[index]!);
  }
  return activities;
}

function assertRadarActivity(
  value: RadarPublicActivity,
  recipient: string,
  expectedActivityId: string,
) {
  if (
    value.schemaVersion !== 'binrat.rat-radar-activity/0.1' ||
    value.chainId !== 5042 ||
    !/^[0-9a-f]{64}$/i.test(value.activityId) ||
    value.activityId.toLowerCase() !== expectedActivityId.toLowerCase() ||
    value.recipient.toLowerCase() !== recipient.toLowerCase()
  ) {
    throw new Error('RAT_RADAR_ACTIVITY_SCHEMA_INVALID');
  }
}

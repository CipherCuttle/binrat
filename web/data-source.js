import { hotGarbageFixtures } from './fixtures.js';

export const WEB_DATA_SOURCE_VERSION = 'BINRAT_WEB_DATA_SOURCE_V0';
export const WEB_DATA_SOURCE_MODE = 'FIXTURE';

export async function loadDumpsterFeed() {
  return {
    version: WEB_DATA_SOURCE_VERSION,
    mode: WEB_DATA_SOURCE_MODE,
    bags: hotGarbageFixtures
  };
}

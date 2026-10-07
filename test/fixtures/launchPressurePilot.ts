import type { HistoricalPressureProject } from '../../src/intelligence/launchPressureBenchmark.js';

export const LAUNCH_PRESSURE_PILOT: readonly HistoricalPressureProject[] = [
  {
    projectId: 'taiko',
    launchOn: '2024-05-27',
    pressure: {
      projectId: 'taiko',
      receipts: [
        {
          observedOn: '2024-04-22',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://github.com/taikoxyz/taiko-mono/commit/8e1221081c4f8bec4963c8dd64ace64fb1413c9b'
        },
        {
          observedOn: '2024-05-11',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://github.com/taikoxyz/taiko-mono/commit/dd8725f8d27f835102fa3c5a013003090268357d'
        },
        {
          observedOn: '2024-05-13',
          kind: 'PRODUCTION_DEPLOYMENT',
          sourceRef: 'https://github.com/taikoxyz/taiko-mono/commit/c6a7e4ce260deec0277fd750d1e93cc2a2fbf9d4'
        }
      ]
    }
  },
  {
    projectId: 'aptos',
    launchOn: '2022-10-12',
    pressure: {
      projectId: 'aptos',
      receipts: [
        {
          observedOn: '2022-09-17',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://github.com/aptos-labs/aptos-core/commit/497e10c30d79a233ac43e20d45d2e5a287f22fcb'
        },
        {
          observedOn: '2022-10-04',
          kind: 'PRODUCTION_DEPLOYMENT',
          sourceRef: 'https://github.com/aptos-labs/aptos-core/commit/955d081e81d0d95b62f4c0077ee6ca62655c3185'
        },
        {
          observedOn: '2022-10-04',
          kind: 'PRODUCTION_INFRA',
          sourceRef: 'https://github.com/aptos-labs/aptos-core/commit/4dcf8395b39ebb0c5ff7efcd8762f6770f1a30fc'
        }
      ]
    }
  },
  {
    projectId: 'celestia',
    launchOn: '2023-10-31',
    pressure: {
      projectId: 'celestia',
      receipts: [
        {
          observedOn: '2023-09-07',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://github.com/celestiaorg/celestia-node/commit/b1a6349ca839d838740319f2a19818a7481f087e'
        },
        {
          observedOn: '2023-10-13',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://github.com/celestiaorg/celestia-node/commit/a52e2de4a76de0e25e53b04f82894d0f44888bd1'
        }
      ]
    }
  }
] as const;

import type {
  LaunchedPressureProject,
  UnresolvedPressureControl
} from '../../src/intelligence/launchPressureBenchmarkV1.js';

export const LAUNCH_PRESSURE_V1_LAUNCHERS: readonly LaunchedPressureProject[] = [
  {
    projectId: 'taiko',
    launchOn: '2024-05-27',
    coverage: 'VERIFIED',
    coverageReason: 'Source-literal GitHub mainnet chain config and deployment receipts verified in the 120-day prelaunch window.',
    pressure: {
      projectId: 'taiko',
      receipts: [
        {
          observedOn: '2024-04-22',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://github.com/taikoxyz/taiko-mono/commit/8e1221081c4f8bec4963c8dd64ace64fb1413c9b'
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
    projectId: 'scroll',
    launchOn: '2023-10-17',
    coverage: 'PARTIAL',
    coverageReason: 'Prelaunch repo search found genesis and deployment-script work, but the artifacts were not source-literal production/mainnet transitions.',
    pressure: { projectId: 'scroll', receipts: [] }
  },
  {
    projectId: 'zksync-era',
    launchOn: '2023-03-24',
    coverage: 'PARTIAL',
    coverageReason: 'The public zksync-era repo was newly created shortly before public Alpha; no two source-literal P1-P6 families were verified before launch.',
    pressure: { projectId: 'zksync-era', receipts: [] }
  },
  {
    projectId: 'starknet',
    launchOn: '2021-11-29',
    coverage: 'PARTIAL',
    coverageReason: 'Official Alpha 4 was explicitly the mainnet release candidate, but a second independent P1-P6 family was not verified prelaunch.',
    pressure: {
      projectId: 'starknet',
      receipts: [
        {
          observedOn: '2021-11-17',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://www.starknet.io/blog/starknet-alpha-4-release/'
        }
      ]
    }
  },
  {
    projectId: 'fuel',
    launchOn: '2024-09-25',
    coverage: 'PARTIAL',
    coverageReason: 'Repository showed frequent releases and test infrastructure, but no two source-literal production/mainnet P1-P6 families were verified.',
    pressure: { projectId: 'fuel', receipts: [] }
  },
  {
    projectId: 'aleo',
    launchOn: '2024-09-18',
    coverage: 'VERIFIED',
    coverageReason: 'GitHub exposes distinct mainnet bootstrap infrastructure and an explicit Mainnet Beta release transition before launch.',
    pressure: {
      projectId: 'aleo',
      receipts: [
        {
          observedOn: '2024-09-03',
          kind: 'PRODUCTION_INFRA',
          sourceRef: 'https://github.com/ProvableHQ/snarkOS/commit/12cf23280b9d41f2f387c0e0b616b2108442e0bf'
        },
        {
          observedOn: '2024-09-04',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://github.com/ProvableHQ/snarkOS/commit/30c8e85a112cacc17d0582840b2feba07154c647'
        }
      ]
    }
  },
  {
    projectId: 'celestia',
    launchOn: '2023-10-31',
    coverage: 'VERIFIED',
    coverageReason: 'GitHub exposes a v1.0.0 release-candidate transition followed by source-literal mainnet chain-ID configuration.',
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
  },
  {
    projectId: 'berachain',
    launchOn: '2025-02-06',
    coverage: 'PARTIAL',
    coverageReason: 'The frozen Polaris repo did not expose two source-literal production-transition families in the searched prelaunch window.',
    pressure: { projectId: 'berachain', receipts: [] }
  },
  {
    projectId: 'monad',
    launchOn: '2025-11-24',
    coverage: 'PARTIAL',
    coverageReason: 'The public Foundry template does not represent complete protocol production preparation; no two verified P1-P6 families were frozen.',
    pressure: { projectId: 'monad', receipts: [] }
  },
  {
    projectId: 'babylon',
    launchOn: '2025-04-10',
    coverage: 'PARTIAL',
    coverageReason: 'Genesis-related work was found, but it did not establish two distinct source-literal production-transition families.',
    pressure: { projectId: 'babylon', receipts: [] }
  },
  {
    projectId: 'avail',
    launchOn: '2024-07-23',
    coverage: 'VERIFIED',
    coverageReason: 'Official Road-to-Mainnet and validator-rollout publications document two distinct mainnet preparation transitions.',
    pressure: {
      projectId: 'avail',
      receipts: [
        {
          observedOn: '2024-07-04',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://blog.availproject.org/road-to-mainnet-june-2024/'
        },
        {
          observedOn: '2024-07-19',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://blog.availproject.org/community-rollout-for-decentralized-mainnet-validators/'
        }
      ]
    }
  },
  {
    projectId: 'eclipse',
    launchOn: '2024-11-07',
    coverage: 'PARTIAL',
    coverageReason: 'The selected public benchmarking repo did not expose two source-literal P1-P6 families in the prelaunch window.',
    pressure: { projectId: 'eclipse', receipts: [] }
  },
  {
    projectId: 'movement',
    launchOn: '2024-12-09',
    coverage: 'VERIFIED',
    coverageReason: 'GitHub exposes an explicit mainnet deployment followed by mainnet token-release artifacts.',
    pressure: {
      projectId: 'movement',
      receipts: [
        {
          observedOn: '2024-09-27',
          kind: 'PRODUCTION_DEPLOYMENT',
          sourceRef: 'https://github.com/movement-network/movement/commit/209a2b7a07391b21aef3867b8d7509ce3fcbf4ad'
        },
        {
          observedOn: '2024-10-09',
          kind: 'TOKEN_DISTRIBUTION',
          sourceRef: 'https://github.com/movement-network/movement/commit/2c192f9be11d2ab81a88de35bb46397397f26873'
        }
      ]
    }
  },
  {
    projectId: 'initia',
    launchOn: '2025-04-24',
    coverage: 'PARTIAL',
    coverageReason: 'Audit-hardening changes are clean P4 evidence, but v1.0.0-beta.0 is not source-literal as a mainnet candidate; no second qualifying family is counted.',
    pressure: {
      projectId: 'initia',
      receipts: [
        {
          observedOn: '2025-03-04',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://github.com/initia-labs/initia/commit/a4505349444a6f0cf08745f5b90e6c25b5109de3'
        }
      ]
    }
  },
  {
    projectId: 'story',
    launchOn: '2025-02-13',
    coverage: 'VERIFIED',
    coverageReason: 'Public Story repo exposes audit fixes, production RPC/explorer wiring, and separate mainnet genesis configuration before launch.',
    pressure: {
      projectId: 'story',
      receipts: [
        {
          observedOn: '2024-12-12',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://github.com/piplabs/story/commit/2b180d7bd88520a6db1c05b59d5352dc5b620df8'
        },
        {
          observedOn: '2024-12-13',
          kind: 'PRODUCTION_INFRA',
          sourceRef: 'https://github.com/piplabs/story/commit/4779e266fa8e3a9f34b2062421a1693911ed4dd9'
        },
        {
          observedOn: '2024-12-18',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://github.com/piplabs/story/commit/e9da1b43eca7caf9c3e6528c3f6ea8b792436401'
        }
      ]
    }
  },
  {
    projectId: 'manta-pacific',
    launchOn: '2023-09-12',
    coverage: 'PARTIAL',
    coverageReason: 'A genesis-storage migration was found but was not explicitly Pacific-mainnet production evidence and no second family was verified.',
    pressure: { projectId: 'manta-pacific', receipts: [] }
  },
  {
    projectId: 'dymension',
    launchOn: '2024-02-06',
    coverage: 'PARTIAL',
    coverageReason: 'Hub-genesis work was source-literal but only one clean pressure family was verified.',
    pressure: {
      projectId: 'dymension',
      receipts: [
        {
          observedOn: '2023-12-17',
          kind: 'PRODUCTION_CHAIN_CONFIG',
          sourceRef: 'https://github.com/dymensionxyz/dymension/commit/5aa7baed586d57d0e48305da41a89e0239451569'
        }
      ]
    }
  },
  {
    projectId: 'sei',
    launchOn: '2023-08-15',
    coverage: 'PARTIAL',
    coverageReason: 'CertiK remediation is clean P4 evidence, but a second production-specific family was not verified before launch.',
    pressure: {
      projectId: 'sei',
      receipts: [
        {
          observedOn: '2023-06-23',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://github.com/sei-protocol/sei-chain/commit/ff6b0b131d1a8464842975c738f5147dd3cd8f8e'
        }
      ]
    }
  },
  {
    projectId: 'aptos',
    launchOn: '2022-10-12',
    coverage: 'VERIFIED',
    coverageReason: 'GitHub exposes mainnet genesis, deployment fixes, and mainnet telemetry configuration before launch.',
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
    projectId: 'sui',
    launchOn: '2023-05-03',
    coverage: 'PARTIAL',
    coverageReason: 'The repo contains explicit Updates for Mainnet, but a second independent source-literal P1-P6 family was not verified without over-interpreting generic explorer/genesis work.',
    pressure: {
      projectId: 'sui',
      receipts: [
        {
          observedOn: '2023-04-21',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://github.com/MystenLabs/sui/commit/cbaf7e750d72467c06b4e93b7ce2f1c27fe1247c'
        }
      ]
    }
  }
] as const;

export const LAUNCH_PRESSURE_V1_CONTROLS: readonly UnresolvedPressureControl[] = [
  {
    projectId: 'fhenix-cofhe',
    observedThrough: '2026-10-07',
    coverage: 'VERIFIED',
    coverageReason: 'Official Fhenix site still says mainnet coming soon/testnet-only; searched five public Fhenix repos for source-literal mainnet/production/deploy/release/audit/token transitions through the 90-day cutoff with no qualifying P1-P6 receipt.',
    pressure: {
      projectId: 'fhenix-cofhe',
      receipts: []
    }
  },
  {
    projectId: 'xeris',
    observedThrough: '2026-10-07',
    coverage: 'VERIFIED',
    coverageReason: 'Official site says testnet live and no mainnet date; CertiK revision completed after the 90-day control cutoff, so it is intentionally present only as future-to-cutoff evidence.',
    pressure: {
      projectId: 'xeris',
      receipts: [
        {
          observedOn: '2026-07-30',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://skynet.certik.com/projects/xeris-web'
        }
      ]
    }
  },
  {
    projectId: 'converge',
    observedThrough: '2026-10-07',
    coverage: 'PARTIAL',
    coverageReason: 'Public evidence establishes delay/no committed launch date, but no authoritative public code surface was frozen for P1-P6 coverage.',
    pressure: {
      projectId: 'converge',
      receipts: []
    }
  }
] as const;

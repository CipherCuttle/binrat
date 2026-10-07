import type { HardDelayedControl } from '../../src/intelligence/hardDelayedControlsBenchmark.js';

export const HARD_DELAYED_CONTROLS_V1: readonly HardDelayedControl[] = [
  {
    projectId: 'tari-minotari',
    targetLabel: 'Tari Minotari mainnet',
    triggerOn: '2023-12-14',
    pressure: {
      projectId: 'tari-minotari',
      receipts: [
        {
          observedOn: '2023-12-14',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://tari.com/updates/2023-12-14-update-124'
        },
        {
          observedOn: '2023-12-14',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://tari.com/updates/2023-12-14-update-124'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2025-05-06',
      sourceRef: 'https://rfc.tari.com/print'
    },
    notes: 'Official update says base-node and wallet audit issues were addressed and publishes the first release candidate believed to contain mainnet code, while explicitly saying it was not the mainnet release.'
  },
  {
    projectId: 'zetachain',
    targetLabel: 'ZetaChain Mainnet Beta',
    triggerOn: '2023-06-08',
    pressure: {
      projectId: 'zetachain',
      receipts: [
        {
          observedOn: '2023-05-16',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://github.com/zeta-chain/node/commit/fb530a2ea4dbc508f2785a8bfcbb684eb1c9db27'
        },
        {
          observedOn: '2023-06-08',
          kind: 'TOKEN_DISTRIBUTION',
          sourceRef: 'https://github.com/zeta-chain/node/commit/1d27bdfe73fd121324b39053b04e19b54066ecfe'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2024-01-31',
      sourceRef: 'https://www.zetachain.com/blog/zetachain-mainnet-beta-is-live'
    },
    notes: 'Public code shows Zellic audit fixes followed by genesis token-distribution work. Mainnet Beta arrived many months later.'
  },
  {
    projectId: 'neon-evm',
    targetLabel: 'Neon EVM production mainnet',
    triggerOn: '2022-12-12',
    pressure: {
      projectId: 'neon-evm',
      receipts: [
        {
          observedOn: '2022-11-04',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://medium.com/ackee-blockchain/neon-labs-neon-evm-audit-summary-416e323badeb'
        },
        {
          observedOn: '2022-12-12',
          kind: 'PRODUCTION_INFRA',
          sourceRef: 'https://medium.com/neon-labs/neon-evms-mainnet-launch-community-update-eeef3aea02a2'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2023-07-17',
      sourceRef: 'https://www.neonevm.org/blog/2023-was-a-big-year-for-neon-evm'
    },
    notes: 'Ackee says Neon supplied an updated codebase that fixed every finding except one informational issue. Weeks later Neon said its production environment and live-dApp infrastructure were technically ready, yet organizational and market dependencies delayed launch for months.'
  },
  {
    projectId: 'namada',
    targetLabel: 'Namada mainnet',
    triggerOn: '2024-08-15',
    pressure: {
      projectId: 'namada',
      receipts: [
        {
          observedOn: '2024-07-09',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://namada.net/blog/the-namada-mainnet-release-candidate-and-the-namada-mainnet-security-program'
        },
        {
          observedOn: '2024-08-15',
          kind: 'TOKEN_DISTRIBUTION',
          sourceRef: 'https://forum.namada.net/t/genesis-balance-files/907'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2024-12-03',
      sourceRef: 'https://namada.net/blog/namada-mainnet-is-live'
    },
    notes: 'Namada had already published its mainnet release candidate when the Anoma Foundation published the genesis balance and transaction files used to build the full genesis block. Mainnet still arrived 110 days later.'
  }
  {
    projectId: 'zksync-era',
    targetLabel: 'zkSync Era public alpha',
    triggerOn: '2022-12-13',
    pressure: {
      projectId: 'zksync-era',
      receipts: [
        {
          observedOn: '2022-10-28',
          kind: 'PRODUCTION_DEPLOYMENT',
          sourceRef: 'https://www.theblock.co/post/180846/matter-labs-releases-first-phase-of-zksync-2-0-mainnet-called-baby-alpha'
        },
        {
          observedOn: '2022-12-13',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://www.openzeppelin.com/news/zksync-layer-1-diff-audit'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2023-03-24',
      sourceRef: 'https://www.theblock.co/news/ecosystems/2023-03-24-zksync-era-first-zkevm-goes-live-in-major-development-for-ethereum-222596'
    },
    notes: 'Baby Alpha put the end-to-end system on Ethereum mainnet with restricted access. The later public OpenZeppelin diff-audit documented an already-deployed alpha system and 15 of 16 findings resolved. Public access still waited another 101 days.'
  },
  {
    projectId: 'rocket-pool',
    targetLabel: 'Rocket Pool mainnet',
    triggerOn: '2021-08-01',
    pressure: {
      projectId: 'rocket-pool',
      receipts: [
        {
          observedOn: '2021-06-15',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://medium.com/rocket-pool/development-update-june-2021-89f3a83011c0'
        },
        {
          observedOn: '2021-08-01',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://github.com/rocket-pool/rocketpool/releases/tag/v1.0.0-rc2'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2021-11-09',
      sourceRef: 'https://medium.com/rocket-pool/where-we-are-and-whats-to-come-7f5f932e9035'
    },
    notes: 'Rocket Pool publicly documented that first-round audit findings were addressed and verified, then cut a second mainnet v1.0.0 release candidate. Mainnet still launched 100 days later.'
  },
] as const;

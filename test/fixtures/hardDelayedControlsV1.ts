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
] as const;

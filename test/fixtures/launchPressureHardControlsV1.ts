import type { HardDelayedControl } from '../../src/intelligence/launchPressureHardControlsV1.js';

export const HARD_DELAYED_CONTROLS_V1: readonly HardDelayedControl[] = [
  {
    projectId: 'tari',
    cutoffOn: '2023-12-14',
    observedThrough: '2025-05-06',
    outcome: 'LATER_LAUNCH',
    launchOn: '2025-05-06',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Tari said its base-node and wallet audit was complete with all identified issues addressed and published its first release candidate as the code it believed would run Minotari mainnet; genesis was still 509 days away.',
    outcomeSourceRef: 'https://rfc.tari.com/print',
    pressure: {
      projectId: 'tari',
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
    }
  },
  {
    projectId: 'zetachain',
    cutoffOn: '2023-06-08',
    observedThrough: '2024-01-31',
    outcome: 'LATER_LAUNCH',
    launchOn: '2024-01-31',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'ZetaChain GitHub contains explicit Zellic audit fixes followed within 60 days by a genesis token-distribution refactor; Mainnet Beta still arrived 237 days after the V0-positive cutoff.',
    outcomeSourceRef: 'https://www.zetachain.com/blog/zetachain-commits-of-total-zeta-supply-to-developer-and-dapp-ecosystem',
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
    }
  },
  {
    projectId: 'neon-evm',
    cutoffOn: '2022-12-12',
    observedThrough: '2023-07-17',
    outcome: 'LATER_LAUNCH',
    launchOn: '2023-07-17',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Ackee documented an updated Neon codebase addressing the audit findings, and Neon then reported its production environment and required live-dApp infrastructure technically ready; production launch still followed 217 days later.',
    outcomeSourceRef: 'https://www.neonevm.org/blog/2023-was-a-big-year-for-neon-evm',
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
    }
  },
  {
    projectId: 'namada',
    cutoffOn: '2024-08-15',
    observedThrough: '2024-12-03',
    outcome: 'LATER_LAUNCH',
    launchOn: '2024-12-03',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Namada published a mainnet release candidate on July 9 and actual genesis balance/transaction files on August 15; decentralized mainnet genesis still followed 110 days after the V0-positive cutoff.',
    outcomeSourceRef: 'https://namada.net/blog/namada-mainnet-is-live',
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
    }
  }
] as const;

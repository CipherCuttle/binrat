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
    projectId: 'qrl-2',
    targetLabel: 'QRL 2.0 / Zond mainnet',
    triggerOn: '2026-04-03',
    pressure: {
      projectId: 'qrl-2',
      receipts: [
        {
          observedOn: '2026-04-03',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://www.theqrl.org/weekly/2026-april-03/'
        },
        {
          observedOn: '2026-04-03',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://www.theqrl.org/weekly/2026-april-03/'
        }
      ]
    },
    outcome: {
      kind: 'UNRESOLVED',
      observedThrough: '2026-10-07',
      sourceRef: 'https://www.theqrl.org/roadmap/'
    },
    notes: 'QRL weekly update says relevant repositories reached code freeze and two cryptographic-library audits were complete. QRL 2.0 remained a future mainnet target through the observation date.'
  },
  {
    projectId: 'shardeum',
    targetLabel: 'Shardeum mainnet',
    triggerOn: '2025-01-15',
    pressure: {
      projectId: 'shardeum',
      receipts: [
        {
          observedOn: '2024-12-17',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://shardeum.org/blog/incentivized-testnet-stage-4/'
        },
        {
          observedOn: '2025-01-15',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://shardeum.org/blog/350k-bug-bounty-iii/'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2025-05-05',
      sourceRef: 'https://shardeum.org/blog/mainnet-launch/'
    },
    notes: 'Official sources describe a pre-mainnet code freeze and say prior bounty programs identified and rectified important vulnerabilities. Token-only mainnet still launched more than 90 days later.'
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
          observedOn: '2022-12-12',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://medium.com/neon-labs/neon-evms-mainnet-launch-community-update-eeef3aea02a2'
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
    notes: 'Neon said audits were complete and the production environment plus live-dApp infrastructure were technically ready, but organizational and market dependencies delayed launch for months.'
  },
  {
    projectId: 'namada',
    targetLabel: 'Namada mainnet',
    triggerOn: '2024-08-26',
    pressure: {
      projectId: 'namada',
      receipts: [
        {
          observedOn: '2024-07-09',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://namada.net/blog/the-namada-mainnet-release-candidate-and-the-namada-mainnet-security-program'
        },
        {
          observedOn: '2024-08-26',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://forum.namada.net/t/the-namada-mainnet-release-candidate-discussions/846'
        }
      ]
    },
    outcome: {
      kind: 'HISTORICAL_LAUNCH',
      launchOn: '2024-12-03',
      sourceRef: 'https://namada.net/blog/namada-mainnet-is-live'
    },
    notes: 'Namada published a mainnet release candidate; a core-contributor forum update later said both listed Informal Systems audits had completed. Mainnet still arrived 99 days after the trigger.'
  }
] as const;

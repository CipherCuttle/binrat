import type { HardDelayedControl } from '../../src/intelligence/launchPressureHardControlsV1.js';

export const HARD_DELAYED_CONTROLS_V1: readonly HardDelayedControl[] = [
  {
    projectId: 'namada',
    cutoffOn: '2024-07-31',
    observedThrough: '2024-12-03',
    outcome: 'LATER_LAUNCH',
    launchOn: '2024-12-03',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Mainnet release candidate was public by July 9 and detailed genesis allocation/distribution infrastructure was public by July 31; mainnet did not launch until December 3.',
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
          observedOn: '2024-07-31',
          kind: 'TOKEN_DISTRIBUTION',
          sourceRef: 'https://namada.net/blog/namada-community-genesis-process-cryptoeconomic-mechanisms-and-the-genesis-allocations'
        }
      ]
    }
  },
  {
    projectId: 'qrl-2',
    cutoffOn: '2026-04-03',
    observedThrough: '2026-10-02',
    outcome: 'STILL_UNLAUNCHED',
    scope: 'NETWORK_UPGRADE',
    evidenceReason: 'QRL 2.0 reported a completed code freeze plus a Halborn cryptography audit whose findings were resolved on April 3; by October 2 the project was still preparing Testnet V3 with audits/remediation only 60% complete.',
    outcomeSourceRef: 'https://www.theqrl.org/weekly/',
    pressure: {
      projectId: 'qrl-2',
      receipts: [
        {
          observedOn: '2026-04-03',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://www.theqrl.org/press/halborn-audit-validates-qrls-postquantum-cryptography-library/'
        },
        {
          observedOn: '2026-04-03',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://www.theqrl.org/weekly/2026-april-03/'
        }
      ]
    }
  },
  {
    projectId: 'tari',
    cutoffOn: '2023-12-14',
    observedThrough: '2025-05-06',
    outcome: 'LATER_LAUNCH',
    launchOn: '2025-05-06',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Tari said its base-node and wallet audit was complete with all identified issues addressed and released the code it believed would run mainnet as its first release candidate; mainnet arrived 509 days later.',
    outcomeSourceRef: 'https://github.com/tari-project/universe/blob/main/CHANGELOG.md',
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
    projectId: 'dusk',
    cutoffOn: '2024-10-09',
    observedThrough: '2025-01-07',
    outcome: 'LATER_LAUNCH',
    launchOn: '2025-01-07',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Dusk published final Rusk node/consensus audit reports with issues resolved or acknowledged, then reported a feature freeze and production-oriented Nocturne readiness; mainnet launched exactly 90 days after the cutoff.',
    outcomeSourceRef: 'https://dusk.network/news/mainnet-is-live',
    pressure: {
      projectId: 'dusk',
      receipts: [
        {
          observedOn: '2024-09-20',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://dusk.network/news/consensus-and-node-audits/'
        },
        {
          observedOn: '2024-10-09',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://dusk.network/news/aug-sept-engineering-update'
        }
      ]
    }
  },
  {
    projectId: 'tenderize-v2',
    cutoffOn: '2023-10-11',
    observedThrough: '2024-01-30',
    outcome: 'LATER_LAUNCH',
    launchOn: '2024-01-30',
    scope: 'PROTOCOL_V2',
    evidenceReason: 'Tenderize reported final Halborn audits returned without vulnerabilities and entry into the v2 code freeze; the v2 mainnet launch followed 111 days later.',
    outcomeSourceRef: 'https://blog.tenderize.me/tenderizev2-launch/',
    pressure: {
      projectId: 'tenderize-v2',
      receipts: [
        {
          observedOn: '2023-10-11',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://www.tenderize.me/blog/septembernewsletter'
        },
        {
          observedOn: '2023-10-11',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://www.tenderize.me/blog/septembernewsletter'
        }
      ]
    }
  },
  {
    projectId: 'oasis',
    cutoffOn: '2020-06-08',
    observedThrough: '2020-11-18',
    outcome: 'LATER_LAUNCH',
    launchOn: '2020-11-18',
    scope: 'NETWORK_MAINNET',
    evidenceReason: 'Oasis declared the network feature-complete, stress-tested and audited after multiple external security audits/bug-bounty/attack exercises had passed, and announced Amber as its first mainnet release candidate; production mainnet followed 163 days later.',
    outcomeSourceRef: 'https://oasis.net/blog/oasis-mainnet-ushering-in-a-new-era-of-privacy-and-scalability',
    pressure: {
      projectId: 'oasis',
      receipts: [
        {
          observedOn: '2020-06-08',
          kind: 'AUDIT_REMEDIATION',
          sourceRef: 'https://oasis.net/blog/introducing-the-amber-network-a-release-candidate-for-mainnet'
        },
        {
          observedOn: '2020-06-08',
          kind: 'RELEASE_CANDIDATE',
          sourceRef: 'https://oasis.net/blog/introducing-the-amber-network-a-release-candidate-for-mainnet'
        }
      ]
    }
  }
] as const;

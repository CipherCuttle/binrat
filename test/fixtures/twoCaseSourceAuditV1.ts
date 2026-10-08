/**
 * Historical case dossiers, not scored launch predictions. Sources were found
 * after outcomes were known; every record remains PARTIAL for out-of-sample
 * model evaluation and lacks frozen raw-body hashes/publication archives.
 */
export const TWO_CASE_SOURCE_AUDIT_V1 = [
  {
    projectId: 'base',
    targetId: 'base-general-availability-2023',
    targetNote: 'Broad public app availability, distinct from builder mainnet July 13 and bridge opening August 3.',
    outcomeOn: '2023-08-09',
    prelaunchEvents: [
      {
        observedOn: '2023-05-24',
        role: 'OPEN_BLOCKER',
        sourceRef: 'https://blog.base.org/path-to-base-mainnet',
        note: 'Official five launch criteria included successful Bedrock upgrade, internal/external audit, and testnet stability; May 24 date cross-checked by May 25 contemporary press.'
      },
      {
        observedOn: '2023-07-13',
        role: 'BLOCKER_CLOSURE_CANDIDATE',
        sourceRef: 'https://blog.base.org/base-mainnet-is-open-for-builders',
        note: 'First-party explicitly states ALL launch criteria satisfied; independently verified line-item closure and immutable snapshot still needed.'
      },
      {
        observedOn: '2023-08-03',
        role: 'EXECUTION_CANDIDATE',
        sourceRef: 'https://basescan.org/tx/0x0ab001315b6ac3504da55224f60e59b6ec9d63924d07d2bf06c32e49264087dc',
        note: 'Third-party explorer indexes successful Bridge to Base NFT mint on Base block 2143911, Aug 3 15:39:29 UTC. A real network tx, but not independently proven to be a protocol-controlled irreversible execution commitment.'
      }
    ],
    outcomeRef:'https://blog.base.org/base-is-open-for-everyone',
    evidenceCoverage: 'PARTIAL',
    preregScoreEligible: false,
    primaryBlocker: 'Both the historical source-availability audit and the required causal tie of a general-user phase to this independent execution event remain incomplete.'
  },
  {
    projectId: 'zksync-era',
    targetId: 'zksync-era-public-alpha-2023',
    targetNote: 'General public access March 24, 2023; earlier October 28 restricted Baby Alpha is NOT user-facing public launch.',
    outcomeOn: '2023-03-24',
    prelaunchEvents: [
      {
        observedOn: '2022-10-28',
        role: 'V0_PRODUCTION_DEPLOYMENT',
        sourceRef: 'https://www.theblock.co/post/180846/matter-labs-releases-first-phase-of-zksync-2-0-mainnet-called-baby-alpha',
        note: 'Production deployment restricted to internal usage; does not equal public access.'
      },
      {
        observedOn: '2022-12-13',
        role: 'V0_AUDIT_REMEDIATION',
        sourceRef: 'https://www.openzeppelin.com/news/zksync-layer-1-diff-audit',
        note: 'OpenZeppelin dated report: 16 findings, 15 resolved; one critical resolved. Audited changes to deployed L1 code. Explicit closure of ALL launch blockers is NOT established.'
      }
    ],
    outcomeRef:'https://www.theblock.co/news/ecosystems/2023-03-24-zksync-era-first-zkevm-goes-live-in-major-development-for-ethereum-222596',
    evidenceCoverage: 'PARTIAL',
    preregScoreEligible: false,
    primaryBlocker: 'No frozen comprehensive blocker inventory, no independent post-closure execution search, and outcome was known before evidence collection.'
  }
] as const;

export const DATED_SCHEDULE_TRAP_V1 = {
  projectId: 'neon-evm',
  targetId: 'neon-public-mainnet-2023',
  schedulePublishedOn:'2022-11-07',
  scheduledLaunchOn:'2022-12-12',
  explicitDelayPublishedOn:'2022-12-12',
  actualLaunchOn:'2023-07-17',
  announcementRef:'https://medium.com/neon-labs/neon-evm-set-to-go-live-on-mainnet-welcome-to-a-new-era-of-ethereum-scalability-on-solana-63b25bcc77a3',
  delayRef:'https://medium.com/neon-labs/neon-evms-mainnet-launch-community-update-eeef3aea02a2',
  outcomeRef:'https://www.neonevm.org/blog/2023-was-a-big-year-for-neon-evm',
  evidenceCoverage:'PARTIAL',
  preregScoreEligible:false,
  note:'Public official date could have produced a 30d dated-announcement positive from Nov 12 to Dec 11, but project then disclosed a blocker and postponed. Not a clean blinded validation case.'
} as const;

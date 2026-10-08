/** 
 * 2026-10-08 seed registry only. These projects require separately pinned 
 * current-mainnet-status receipts before they can be scored or watched.
 * No autonomous fetch, polling, cron, alerting or production authorization.
 */
export const PROSPECTIVE_SHADOW_ROSTER_V1 = {
  freezeOn:'2026-10-08',
  targets:[
    {
      projectId:'logos-mainnet',targetId:'logos-public-mainnet',
      sourceRef:'https://logos.co/roadmap',
      observedClaim:'Official roadmap lists testnet v0.3 LIVE and mainnet in development for H1 2027',
      evidenceStatus:'PARTIAL'
    },
    {
      projectId:'miden-mainnet',targetId:'miden-public-mainnet',
      sourceRef:'https://github.com/0xPolygonMiden',
      observedClaim:'Public GitHub organization currently describes testnet, not an authoritative verified public mainnet release date',
      evidenceStatus:'PARTIAL'
    },
    {
      projectId:'rialo-mainnet',targetId:'rialo-public-mainnet',
      sourceRef:'https://rialoscan.org/',
      observedClaim:'Explorer reports mainnet not live; requires independently verified first-party source and captured timestamp',
      evidenceStatus:'PARTIAL'
    }
  ]
} as const;

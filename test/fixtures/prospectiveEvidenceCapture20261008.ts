/**
 * One-time read-only research snapshot, 2026-10-08.
 * The "rawGithubSources" SHA256 hashes cover the exact GitHub connector
 * JSON response strings committed in sourceFile. This is NOT an audit of
 * the original GitHub/Git server, a raw HTML capture or a live prediction.
 */
export const PROSPECTIVE_EVIDENCE_CAPTURE_20261008 = {
  capturedAt: "2026-10-08T01:52:54.862Z",
  freezeOn: '2026-10-08',
  rawGithubSources: [
  {
    "key": "miden_release_v0172",
    "url": "https://api.github.com/repos/0xMiden/node/releases/tags/v0.17.2",
    "sourceFile": "docs/experiments/receipts/2026-10-08/miden-node-v0.17.2-release.json",
    "contentSha256": "5feeef6e5a557f0e6476f002e58f2983daf72fa75ea31e8554d04c3e4a2ea7c3",
    "bytesUtf8": 4153
  },
  {
    "key": "miden_pr2744",
    "url": "https://api.github.com/repos/0xMiden/node/pulls/2744",
    "sourceFile": "docs/experiments/receipts/2026-10-08/miden-node-pr2744.json",
    "contentSha256": "64750be0af7c119d0ac0cbe7fa2b6734ff6b2c94a27a57848336dc140a86da94",
    "bytesUtf8": 18399
  },
  {
    "key": "miden_pr2743",
    "url": "https://api.github.com/repos/0xMiden/node/pulls/2743",
    "sourceFile": "docs/experiments/receipts/2026-10-08/miden-node-pr2743.json",
    "contentSha256": "14f6e2cb646872cc6c64da92e3a811131ff50899ecd6712fa6da727d43440594",
    "bytesUtf8": 17302
  }
],
  projects: [
    {
      projectId:'logos-mainnet', targetId:'logos-public-mainnet',coverage:'PARTIAL',
      observedReadiness:'TESTNET_V0_3_LIVE',
      officialClaim:'Logos confirms Testnet v0.3 released 2026-09-30 and lists mainnet IN DEVELOPMENT with non-binding H1 2027 goal.',
      sources:[
        {url:'https://logos.co/roadmap',type:'WEB_TEXT_EXCERPT_NOT_RAW_CAPTURE',capturedAt:"2026-10-08T01:52:54.862Z"},
        {url:'https://logos.co/media/article/logos-dev-update-sep-2026',type:'WEB_TEXT_EXCERPT_NOT_RAW_CAPTURE',capturedAt:"2026-10-08T01:52:54.862Z"}
      ],
      missing:'Raw response bytes/hash, stable revision history, explicit production action, exact future launch day. H1 2027 is not an eligible dated-launch event.',
      pressureV0Admitted:false,convergenceV1Admitted:false
    },
    {
      projectId:'miden-mainnet',targetId:'miden-public-mainnet',coverage:'PARTIAL',
      observedReadiness:'MAINNET_BOOTSTRAP_CODE_SHIPPED',
      officialClaim:'Miden node GitHub release v0.17.2 published 2026-10-07. PR #2744 added mainnet bootstrap/network flags; PR #2743 hardened the genesis fee faucet.',
      immutableCodeRef:'https://github.com/0xMiden/node/commit/40f458ed3c20fb1ef2ddc71e3d70d840aed4be47',
      sources: [
    {
        "url": "https://api.github.com/repos/0xMiden/node/releases/tags/v0.17.2",
        "type": "GITHUB_API_JSON_CAPTURED",
        "capturedAt": "2026-10-08T01:52:54.862Z",
        "sourceFile": "docs/experiments/receipts/2026-10-08/miden-node-v0.17.2-release.json",
        "contentSha256": "5feeef6e5a557f0e6476f002e58f2983daf72fa75ea31e8554d04c3e4a2ea7c3"
    },
    {
        "url": "https://api.github.com/repos/0xMiden/node/pulls/2744",
        "type": "GITHUB_API_JSON_CAPTURED",
        "capturedAt": "2026-10-08T01:52:54.862Z",
        "sourceFile": "docs/experiments/receipts/2026-10-08/miden-node-pr2744.json",
        "contentSha256": "64750be0af7c119d0ac0cbe7fa2b6734ff6b2c94a27a57848336dc140a86da94"
    },
    {
        "url": "https://api.github.com/repos/0xMiden/node/pulls/2743",
        "type": "GITHUB_API_JSON_CAPTURED",
        "capturedAt": "2026-10-08T01:52:54.862Z",
        "sourceFile": "docs/experiments/receipts/2026-10-08/miden-node-pr2743.json",
        "contentSha256": "14f6e2cb646872cc6c64da92e3a811131ff50899ecd6712fa6da727d43440594"
    }
],
      missing:'Onchain production genesis, publicly usable mainnet, operational activation, explicit launch date, closed blocker inventory and independently verified production commitment.',
      pressureV0Admitted:false,convergenceV1Admitted:false
    },
    {
      projectId:'rialo-mainnet',targetId:'rialo-public-mainnet',coverage:'PARTIAL',
      observedReadiness:'SOURCE_CONFLICT_UNRESOLVED',
      officialClaim:'Rialo first-party post published 2025-09-25 introduced a private devnet. It does not establish present-day public mainnet status.',
      sources:[
        {url:'https://www.rialo.io/posts/introducing-rialo/',type:'WEB_TEXT_EXCERPT_NOT_RAW_CAPTURE',capturedAt:"2026-10-08T01:52:54.862Z"},
        {url:'https://rialoscan.org/',type:'UNVERIFIED_EXPLORER_SEARCH_RESULT_HTTP_402',capturedAt:"2026-10-08T01:52:54.862Z"},
        {url:'https://rialo-os.vercel.app/build',type:'UNVERIFIED_THIRD_PARTY_CLAIM',capturedAt:"2026-10-08T01:52:54.862Z"}
      ],
      missing:'First-party attestation that rialoscan.org is official, consistent authenticated testnet/mainnet status, full source hash/response and independent raw chain evidence.',
      pressureV0Admitted:false,convergenceV1Admitted:false
    }
  ]
} as const;

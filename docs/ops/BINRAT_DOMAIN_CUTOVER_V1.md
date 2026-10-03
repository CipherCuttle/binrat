# BINRAT Domain Cutover V1 Receipt

- Timestamp (UTC): `2026-10-03T00:16:14Z`
- Registrar: Namecheap
- Domain: `binrat.tech`
- Operation branch: `ops/binrat-domain-cutover-v1`
- State: `BLOCKED — NAMECHEAP USERNAME NOT RESOLVED`

## Preflight result

The owner-authorized temporary API key was available for this bounded operation,
but the required non-secret Namecheap account identity could not be resolved.
The following sources were checked without printing or loading any credential
value:

- `NAMECHEAP_API_USER`
- `NAMECHEAP_USERNAME`
- existing untracked local Namecheap/domain configuration
- current shell environment and shell setup
- this prior domain-cutover worktree

No account username/API-user was found. The Namecheap API requires both
`ApiUser` and `UserName`; neither was invented. Therefore the required initial
read-only `namecheap.domains.dns.getList` call and `setCustom` delegation change
were not attempted. The temporary API key was not loaded into a process or
written to disk.

## Cloudflare state

- Cloudflare OAuth: authenticated as `pettevik@gmail.com`
- Cloudflare account: `8927d39146b901d0f463b971a1d039e6`
- Cloudflare zone ID: not queried or created
- Assigned nameservers: not assigned / not queried
- Zone activation status: not queried
- Reason: the required registrar read gate failed before any zone creation or
  delegation change. Wrangler OAuth authentication is available; no
  `CLOUDFLARE_API_TOKEN` was required.

## Custom domain state

No Worker custom-domain route was inspected, created, or changed. The existing
`https://binrat-edge-v0.pettevik.workers.dev/health` fallback was read and
returned `ok: true` with release SHA
`53325fd0806765578ed6921428ad55f15a9728f1`.

The remaining owner-authorized operation, after successful registrar and zone
preflight, is to attach `binrat.tech` to the existing `binrat-edge-v0` Worker
as a custom domain only if that remote operation does not upload a Worker
version or alter reviewed traffic semantics.

## Safety receipt

No Namecheap API call, Namecheap DNS change, Cloudflare zone creation,
Cloudflare DNS change, Worker deployment/version/traffic change, Telegram URL
change, PONS flag change, D1 change, repository merge, or workers.dev change
was made. No temporary secret file exists in this worktree and no credential is
tracked by Git. The existing `https://binrat-edge-v0.pettevik.workers.dev`
rollback/reference URL was not modified.

## Resume gate

Supply the exact existing Namecheap account username/API-user through a secure
local environment. Resume with the required read-only
`namecheap.domains.dns.getList` call using the whitelisted caller IPv4; do not
infer registrar ownership or nameserver values before that succeeds.

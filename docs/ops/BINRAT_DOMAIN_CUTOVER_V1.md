# BINRAT Domain Cutover V1 Receipt

- Timestamp (UTC): `2026-10-03T00:54:39Z`
- Registrar: Namecheap
- Domain: `binrat.tech`
- Operation branch: `ops/binrat-domain-cutover-v1`
- State: `DNS PROPAGATION PENDING`

## Credential and account authority

The owner-authorized temporary credentials were sourced only into the command
process from the local mode-`600` credential file. Neither credential value was
printed, committed, or written to this worktree.

- Cloudflare token verification: HTTP 200; token state `active`
- Cloudflare account enumeration: one account available
- Worker ownership verification: `binrat-edge-v0` is present in account
  `8927d39146b901d0f463b971a1d039e6` (`Pettevik@gmail.com's Account`)

## Zone and registrar result

- Cloudflare zone lookup before creation: zero matching `binrat.tech` zones
- Cloudflare zone creation: succeeded once as a `full` zone in the verified
  Worker-owning account
- Cloudflare zone ID: `d3e75f47a8fdd9f0af6d46b5317840f9`
- Assigned Cloudflare nameservers:
  - `faye.ns.cloudflare.com`
  - `yichun.ns.cloudflare.com`
- Namecheap `namecheap.domains.dns.setCustom`: succeeded with `Updated: true`
- Namecheap `namecheap.domains.getInfo` readback: `OK`; exact nameserver match
  verified for the pair above
- Cloudflare zone lookup after delegation: exactly one matching zone; current
  state `pending`

The zone was polled with a bounded wait and remained `pending`. No manual apex
DNS record was created; Cloudflare Custom Domains will own the hostname only
after the zone is active and a later authorized routing-only attachment occurs.

## Worker and product safety result

Because the zone is not active, no Worker Custom Domain was listed, created, or
changed. In particular, no `PUT /workers/domains` request was made.

- Active `binrat-edge-v0` deployment:
  `bdc911f5-caa2-41a3-a41a-822f4c2b811c`
- Active Worker version: `5acbbfe6-b88f-4d22-a074-c473d4e62aee` at 100%
- `https://binrat-edge-v0.pettevik.workers.dev/health`: HTTP 200

No Worker source upload, Worker version or traffic change, D1 migration,
Telegram configuration change, PONS funding change, Autonomous Rat change,
repository merge, or workers.dev disablement was performed.

## Remaining work

Wait for Cloudflare to report zone status `active`. Then, under the existing
owner authorization, attach `binrat.tech` to the unchanged `binrat-edge-v0`
Worker through the Custom Domain API; recheck the exact active version and
verify the public domain paths plus the workers.dev fallback.

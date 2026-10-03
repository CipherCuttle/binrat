# BINRAT Domain Cutover V1 Receipt

- Timestamp (UTC): `2026-10-03T01:02:42Z`
- Registrar: Namecheap
- Domain: `binrat.tech`
- Operation branch: `ops/binrat-domain-cutover-v1`
- State: `DOMAIN DNS ACTIVE / CUSTOM DOMAIN ATTACHED`

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
- Parent/TLD delegation verification: `dig +trace`, recursive `dig`, and all
  four authoritative `.tech` servers resolve exactly the assigned Cloudflare
  nameserver pair
- DNSSEC verification: authoritative `.tech` DS responses have an empty answer
  with signed denial of existence; no stale registrar DS record exists
- Cloudflare `PUT /activation_check`: called once; HTTP 200
- Cloudflare zone lookup after the activation recheck: exactly one matching
  zone; state `active`

No manual apex DNS record was created. Cloudflare Custom Domains owns the apex
hostname and created the authoritative Cloudflare edge A records.

## Worker and product safety result

After the zone became active, the Custom Domain API attached exactly one
production domain record without a Worker upload or deployment action:

- Custom Domain ID: `d5c6b92277ae8d0dee77b38b36f9f37a5cabeb4d`
- Hostname: `binrat.tech`
- Service: `binrat-edge-v0`
- Zone ID: `d3e75f47a8fdd9f0af6d46b5317840f9`

- Active `binrat-edge-v0` deployment:
  `bdc911f5-caa2-41a3-a41a-822f4c2b811c`
- Active Worker version: `5acbbfe6-b88f-4d22-a074-c473d4e62aee` at 100%
- `https://binrat-edge-v0.pettevik.workers.dev/health`: HTTP 200, TLS verified
- New domain HTTPS probes: `/`, `/health`, and `/api/health` currently return
  a TLS handshake-failure alert during bounded post-attachment checks.
  Certificate issuance/readiness is pending; this is not a Worker code failure.

No Worker source upload, Worker version or traffic change, D1 migration,
Telegram configuration change, PONS funding change, Autonomous Rat change,
repository merge, or workers.dev disablement was performed.

## Remaining work

Wait for Custom Domain certificate issuance to complete, then recheck
`https://binrat.tech/`, `/health`, and `/api/health`. The DNS delegation,
active-zone state, Custom Domain attachment, and workers.dev fallback are
already established.

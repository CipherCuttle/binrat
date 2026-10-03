# BINRAT Domain Cutover V1 Receipt

- Timestamp (UTC): `2026-10-03T00:39:00Z`
- Registrar: Namecheap
- Domain: `binrat.tech`
- Operation branch: `ops/binrat-domain-cutover-v1`
- State: `BLOCKED — TEMPORARY CLOUDFLARE API TOKEN NOT AVAILABLE TO THIS SESSION`

## Preflight result

The Namecheap account identity was initially unresolved. The following sources
were checked without printing any credential value:

- `NAMECHEAP_API_USER`
- `NAMECHEAP_USERNAME`
- existing untracked local Namecheap/domain configuration
- current shell environment and shell setup
- this prior domain-cutover worktree

The owner then supplied the existing account username/API-user, `virrpe`. A
read-only `namecheap.domains.getInfo` call succeeded with `Status: OK` and
reported the current delegation as:

- `dns1.registrar-servers.com`
- `dns2.registrar-servers.com`

`namecheap.domains.dns.setCustom` was not called because Cloudflare zone
creation was rejected before Cloudflare could assign the required nameserver
pair. The temporary API key was used only in the request process environment;
it was never written to disk.

## Cloudflare state

The owner authorized a temporary API token supplied through
`CLOUDFLARE_API_TOKEN` for this bounded cutover. Before any mutation, both the
login-shell and non-login-shell command environments were checked without
printing the value. The variable was absent in both. Consequently,
`GET /user/tokens/verify`, account enumeration under the temporary token, zone
creation, registrar delegation, and custom-domain attachment could not be
performed in this session.

The prior Wrangler OAuth state remains relevant only as historical context:

- Cloudflare OAuth: authenticated as `pettevik@gmail.com`
- Cloudflare account: `8927d39146b901d0f463b971a1d039e6`
- Cloudflare zone lookup: exactly zero `binrat.tech` zones
- Cloudflare zone ID: not created
- Assigned nameservers: not assigned / not queried
- Zone activation status: not queried
- Fresh device authorization granted exactly the available minimum OAuth scopes:
  `user:read`, `account:read`, `zone:read`, `workers:write`,
  `workers_routes:write`, and `workers_scripts:write`.
- Zone-create attempt after fresh authorization: rejected before creation with
  `Requires permission "com.cloudflare.api.account.zone.create" to create zones
  for the selected account`.
- Result: the selected Cloudflare account itself lacks zone-create authority;
  this is not remediable through Wrangler's available OAuth scope selection.

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

No Namecheap DNS change, Cloudflare zone creation, Cloudflare DNS change,
Worker deployment/version/traffic change, Telegram URL change, PONS flag
change, D1 change, repository merge, or workers.dev change was made. No
temporary secret file exists in this worktree and no credential is tracked by
Git. The existing `https://binrat-edge-v0.pettevik.workers.dev`
rollback/reference URL was not modified.

## Resume gate

Make the authorized temporary token available to the execution environment as
`CLOUDFLARE_API_TOKEN`, then resume with its non-mutating token verification
and exact Worker-account discovery. Only after Cloudflare returns its exact
nameserver pair may the authorized Namecheap delegation change proceed.

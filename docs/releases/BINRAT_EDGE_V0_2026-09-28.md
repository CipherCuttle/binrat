# BINRAT Edge v0 public-beta release — 2026-09-28

## Immutable deployed code

- Service: `binrat-edge-v0`
- Deployed code SHA: `b286f68f09494e58ecbba113c393679210eb2af1`
- Worker version: `f2bc0c47-d9b8-4a5d-a72c-f0b60a199843`
- Deployment ID: `e48fde91-949d-4a8e-93d3-17d3b0cbdf12`
- Promotion: 2026-09-28 19:20:40 UTC (candidate promoted to 100%)
- Previous known-good Worker version / rollback target: `f66177a1-6841-45e1-ad10-bedf02f248cb`
- Production backend baseline: `8f82cb75c23c4130f97b4de22c4069a4e130dd60`
- Frontend hardening source: `a911c23b70ea5e2286afaf0d9a3dfef5fc697a85` (the deployed release contains its production-integrated equivalent)

## Release evidence

- Automated tests: 213 PASS.
- Public smoke: PASS.
- `/health` release-SHA stamp: PASS — `releaseSha` equals the deployed code SHA.
- `launchAuthorization`: `BLOCKED` (intentional, unchanged).
- History coverage remains `UNVERIFIED` where displayed.
- Token remains `NOT_LAUNCHED`; no official contract is published.

## Documentation commit boundary

This file is committed after the deployment as repository documentation only.
Its commit SHA is **not** a deployed-code SHA and does not trigger or imply a Worker deployment. The immutable production code remains `b286f68f09494e58ecbba113c393679210eb2af1`.

## Beta policy

The current public-beta frontend and visual direction are frozen. Change only for a Critical/High usability regression or repeated user evidence. No speculative redesign or revival of historical G4/G5/G6 experiments is authorized during beta observation.

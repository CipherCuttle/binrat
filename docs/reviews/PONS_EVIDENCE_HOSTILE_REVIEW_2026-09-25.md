# Pons evidence hostile review — 2026-09-25

Review target: PR #40 evidence commit `c16cd0790ae962a9c4fa3d78698af67eba28fba0`.

Finding: the first offline verifier compared two proof files but did not bind
each proof to a distinct provider identity or re-derive indexed event values
from raw receipt topics/data. That weakened the machine-checkable independence
claim even though the collection run itself used two providers.

Disposition: fixed by adding provider IDs/endpoints, requiring distinct
provider-to-proof mappings, and checking transaction/block/log identity plus
the three indexed address topics and three ABI data words against the decoded
launch projection. Targeted rereview passes with the package verifier and the
Pons test suite. No Critical/High finding remains in this bounded milestone.

Remaining limitations are explicit: explorer indexing disagreement is retained,
creator fee recipient is absent from `TokenLaunched`, and curve/graduation/V4
state are not claimed.

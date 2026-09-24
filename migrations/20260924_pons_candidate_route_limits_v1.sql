-- Candidate-only request budget. No live D1 mutation without separate authorization.
CREATE TABLE IF NOT EXISTS pons_candidate_route_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start_ms INTEGER NOT NULL CHECK(window_start_ms >= 0),
  hits INTEGER NOT NULL CHECK(hits >= 1)
);

// Adapted from Sentry FORWARD_OUTCOMES_R1 horizon machinery; BINRAT owns this local contract.
export const OBSERVATION_HORIZONS = Object.freeze([
  { label: '5m', ms: 300_000 },
  { label: '1h', ms: 3_600_000 },
  { label: '24h', ms: 86_400_000 }
] as const);

export type ObservationHorizon = (typeof OBSERVATION_HORIZONS)[number];

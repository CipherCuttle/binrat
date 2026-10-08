import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateConvergenceHoldout,
  LAUNCH_CONVERGENCE_FROZEN_PLAN,
  type ConvergenceHoldoutEntry
} from '../src/intelligence/launchConvergencePrereg.js';
import { LAUNCH_CONVERGENCE_HOLDOUT_V1 } from './fixtures/launchConvergenceHoldoutV1.js';
import {
  LAUNCH_PRESSURE_V1_CONTROLS,
  LAUNCH_PRESSURE_V1_LAUNCHERS
} from './fixtures/launchPressureBenchmarkV1.js';
import { HARD_DELAYED_CONTROLS_V1 } from './fixtures/hardDelayedControlsV1.js';

const used = new Set([
  ...LAUNCH_PRESSURE_V1_LAUNCHERS.map((x) => x.projectId),
  ...LAUNCH_PRESSURE_V1_CONTROLS.map((x) => x.projectId),
  ...HARD_DELAYED_CONTROLS_V1.map((x) => x.projectId),
  'zetachain', // reviewed, then excluded from the strict hard negatives
  'sonic', 'qrl-2', 'shardeum', 'namada', 'tari-minotari',
  'neon-evm', 'rocket-pool' // researched hard-control candidates
]);

test('preregistered 12-project roster is unique, class-diverse and project-disjoint', () => {
  assert.doesNotThrow(() => validateConvergenceHoldout(LAUNCH_CONVERGENCE_HOLDOUT_V1, used));
  assert.equal(LAUNCH_CONVERGENCE_HOLDOUT_V1.length, 12);
  assert.deepEqual(LAUNCH_CONVERGENCE_FROZEN_PLAN.historicalLeadDays, [180, 90, 45, 30, 14, 7]);
});

test('roster rejects retrospective outcome fields and future evidence', () => {
  const invalid = LAUNCH_CONVERGENCE_HOLDOUT_V1.map((x) => ({ ...x }));
  (invalid[0] as ConvergenceHoldoutEntry & { launchOn?: string }).launchOn = '2025-01-01';
  assert.throws(() => validateConvergenceHoldout(invalid, used), /CONVERGENCE_HOLDOUT_LABEL_LEAK/);
});

test('roster rejects projects already studied in previous benchmarks', () => {
  const invalid = LAUNCH_CONVERGENCE_HOLDOUT_V1.map((x) => ({ ...x }));
  invalid[0]!.projectId = 'taiko';
  assert.throws(() => validateConvergenceHoldout(invalid, used), /CONVERGENCE_HOLDOUT_PREVIOUSLY_STUDIED/);
});

test('roster rejects duplicates and incomplete cohort', () => {
  const invalid = LAUNCH_CONVERGENCE_HOLDOUT_V1.map((x) => ({ ...x }));
  invalid[1]!.projectId = invalid[0]!.projectId;
  assert.throws(() => validateConvergenceHoldout(invalid, used), /CONVERGENCE_HOLDOUT_DUPLICATE/);
  assert.throws(() => validateConvergenceHoldout(invalid.slice(1), used), /CONVERGENCE_HOLDOUT_SIZE_INVALID/);
});

test('frozen plan is conservative and does not claim a validated detector', () => {
  assert.equal(LAUNCH_CONVERGENCE_FROZEN_PLAN.predictionHorizonDays, 30);
  assert.equal(LAUNCH_CONVERGENCE_FROZEN_PLAN.actionFreshnessDays, 30);
  assert.equal(LAUNCH_CONVERGENCE_FROZEN_PLAN.closureToActionMaxDays, 30);
  assert.equal(LAUNCH_CONVERGENCE_FROZEN_PLAN.minimumVerifiedLaunchers, 8);
  assert.equal(LAUNCH_CONVERGENCE_FROZEN_PLAN.minimumV0PositiveDelayedControls, 5);
});

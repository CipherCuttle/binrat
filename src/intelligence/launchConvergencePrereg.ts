/**
 * Experimental preregistration contract. This module does not predict launches.
 * No live integration, scorer or mutable detector thresholds are authorized here.
 */
export const LAUNCH_CONVERGENCE_PREREG_VERSION = 'BINRAT_LAUNCH_CONVERGENCE_PREREG_V1' as const;

export const LAUNCH_CONVERGENCE_FROZEN_PLAN = Object.freeze({
  targetHoldoutProjects: 12,
  predictionHorizonDays: 30,
  actionFreshnessDays: 30,
  closureToActionMaxDays: 30,
  historicalLeadDays: [180, 90, 45, 30, 14, 7] as const,
  minimumVerifiedLaunchers: 8,
  minimumVerifiedDelayedProjectControls: 4,
  minimumV0PositiveDelayedControls: 5,
  minimum14dRecall: 0.60,
  minimumRelativeFalseClockReduction: 0.50,
  maximumRecallLossVsV0: 0.10
});

export type LaunchTargetClass = 'ROLLUP' | 'L1_OR_APPCHAIN';

export interface ConvergenceHoldoutEntry {
  projectId: string;
  targetLabel: string;
  targetClass: LaunchTargetClass;
}

const FIELDS = ['projectId', 'targetLabel', 'targetClass'] as const;

export function validateConvergenceHoldout(
  entries: readonly ConvergenceHoldoutEntry[],
  previouslyStudiedProjectIds: ReadonlySet<string>
): void {
  if (entries.length !== LAUNCH_CONVERGENCE_FROZEN_PLAN.targetHoldoutProjects) {
    throw new Error('CONVERGENCE_HOLDOUT_SIZE_INVALID');
  }
  const seen = new Set<string>();
  const classes = new Set<LaunchTargetClass>();
  for (const entry of entries) {
    // Do not put retrospective outcomes, dates, source receipts or launch labels
    // in this roster. They belong in a separate, later sealed evaluation dataset.
    if (Object.keys(entry).some((key) => !FIELDS.includes(key as typeof FIELDS[number]))) {
      throw new Error('CONVERGENCE_HOLDOUT_LABEL_LEAK');
    }
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(entry.projectId) || !entry.targetLabel.trim()) {
      throw new Error('CONVERGENCE_HOLDOUT_ENTRY_INVALID');
    }
    if (entry.targetClass !== 'ROLLUP' && entry.targetClass !== 'L1_OR_APPCHAIN') {
      throw new Error('CONVERGENCE_HOLDOUT_CLASS_INVALID');
    }
    if (seen.has(entry.projectId)) throw new Error('CONVERGENCE_HOLDOUT_DUPLICATE');
    if (previouslyStudiedProjectIds.has(entry.projectId)) {
      throw new Error('CONVERGENCE_HOLDOUT_PREVIOUSLY_STUDIED');
    }
    seen.add(entry.projectId);
    classes.add(entry.targetClass);
  }
  if (classes.size !== 2) throw new Error('CONVERGENCE_HOLDOUT_CLASS_COVERAGE');
}

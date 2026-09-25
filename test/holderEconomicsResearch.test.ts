import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';
const cli = new URL('../scripts/research/holder-economics.mjs', import.meta.url).pathname;
function evaluate(args: string[] = []) {
  const out = execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('economic lab labels all outputs illustrative, not Pons forecasts', () => {
  const result = evaluate();
  assert.equal(result.status, 'ILLUSTRATIVE_NOT_FORECAST');
  assert.ok(result.notIncluded.includes('Taxes and VAT'));
  assert.equal(result.assumptions.effectiveFeeBps, 35);
});

test('zero volume and zero paid seats cannot bankroll fixed operating costs', () => {
  const result = evaluate(['--volumeUsd=0', '--paidSeats=0', '--fixedCostUsd=600']);
  assert.equal(result.projectFeeReceiptsUsd, 0);
  assert.equal(result.seatRevenueNetUsd, 0);
  assert.equal(result.monthlyContributionBeforeOmittedCostsUsd, -600);
});

test('frozen invented worked example reconciles net subscription and break-even', () => {
  const result = evaluate([
    '--volumeUsd=100000', '--effectiveFeeBps=35', '--paidSeats=25',
    '--seatPriceUsd=12', '--merchantFeeBps=500', '--seatVariableCostUsd=2',
    '--fixedCostUsd=600'
  ]);
  assert.equal(result.projectFeeReceiptsUsd, 350);
  assert.equal(result.seatRevenueGrossUsd, 300);
  assert.equal(result.merchantFeesUsd, 15);
  assert.equal(result.seatRevenueNetUsd, 285);
  assert.equal(result.seatVariableCostUsd, 50);
  assert.equal(result.monthlyContributionBeforeOmittedCostsUsd, -15);
  assert.equal(result.breakEvenEligibleMonthlyVolumeUsd, 104286);
});

test('zero effective fees with unfunded fixed costs has no finite volume break-even', () => {
  const result = evaluate([
    '--volumeUsd=1000000', '--effectiveFeeBps=0',
    '--paidSeats=0', '--fixedCostUsd=600'
  ]);
  assert.equal(result.projectFeeReceiptsUsd, 0);
  assert.equal(result.breakEvenEligibleMonthlyVolumeUsd, null);
});

test('a genuinely independent paying-seat case can break even at zero token fees', () => {
  const result = evaluate([
    '--volumeUsd=0', '--effectiveFeeBps=0', '--paidSeats=100',
    '--fixedCostUsd=600'
  ]);
  assert.equal(result.seatRevenueNetUsd, 1140);
  assert.equal(result.seatVariableCostUsd, 200);
  assert.equal(result.monthlyContributionBeforeOmittedCostsUsd, 340);
  assert.equal(result.breakEvenEligibleMonthlyVolumeUsd, 0);
});

test('lab rejects negative, unknown, excessive bps and duplicate CLI overrides', () => {
  for (const arg of ['--volumeUsd=-1', '--unknown=3', '--effectiveFeeBps=10001']) {
    const r = spawnSync(process.execPath, [cli, arg], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, arg);
  }
  const duplicated = spawnSync(process.execPath,
    [cli, '--paidSeats=1', '--paidSeats=2'], { encoding: 'utf8' });
  assert.notEqual(duplicated.status, 0);
  assert.deepEqual(evaluate(), evaluate(), 'same assumptions must produce identical outputs');
});

test('lab fails closed if modeled break-even exceeds safe integer range', () => {
  const r = spawnSync(process.execPath, [cli,
    '--volumeUsd=0', '--effectiveFeeBps=1', '--paidSeats=1000000',
    '--seatVariableCostUsd=1000000', '--fixedCostUsd=1000000000'
  ], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /RESEARCH_BREAK_EVEN_OUT_OF_RANGE/);
});

test('dual-chain stress keeps subscription revenue separate from token fees', () => {
  const result = evaluate(['--volumeUsd=0', '--effectiveFeeBps=0', '--paidSeats=25', '--fixedCostUsd=2000']);
  assert.equal(result.seatRevenueNetUsd, 285);
  assert.equal(result.projectFeeReceiptsUsd, 0);
  assert.equal(result.monthlyContributionBeforeOmittedCostsUsd, -1765);
  assert.equal(result.breakEvenEligibleMonthlyVolumeUsd, null);
  const hypotheticalFees = evaluate(['--volumeUsd=0', '--effectiveFeeBps=35', '--paidSeats=25', '--fixedCostUsd=2000']);
  assert.equal(hypotheticalFees.breakEvenEligibleMonthlyVolumeUsd, 504286);
});

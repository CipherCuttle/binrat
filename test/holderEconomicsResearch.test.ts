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

test('zero-token-fee Pro sensitivity gates at 139 $19 seats and 89 $29 seats', () => {
  const common = ['--volumeUsd=0','--effectiveFeeBps=0','--merchantFeeBps=800','--fixedCostUsd=2000'];
  const below19 = evaluate([...common,'--seatPriceUsd=19','--seatVariableCostUsd=3','--paidSeats=138']);
  const pass19 = evaluate([...common,'--seatPriceUsd=19','--seatVariableCostUsd=3','--paidSeats=139']);
  const below29 = evaluate([...common,'--seatPriceUsd=29','--seatVariableCostUsd=4','--paidSeats=88']);
  const pass29 = evaluate([...common,'--seatPriceUsd=29','--seatVariableCostUsd=4','--paidSeats=89']);
  assert.equal(below19.monthlyContributionBeforeOmittedCostsUsd, -1.76);
  assert.equal(pass19.monthlyContributionBeforeOmittedCostsUsd, 12.72);
  assert.equal(below29.monthlyContributionBeforeOmittedCostsUsd, -4.16);
  assert.equal(pass29.monthlyContributionBeforeOmittedCostsUsd, 18.52);
  assert.equal(pass29.projectFeeReceiptsUsd, 0);
});

test('discounted Pro holder unit-cost stress still requires paying seats', () => {
  const common = ['--volumeUsd=0','--effectiveFeeBps=0','--merchantFeeBps=800','--fixedCostUsd=2000',
    '--seatPriceUsd=24','--seatVariableCostUsd=4'];
  const below = evaluate([...common,'--paidSeats=110']);
  const pass = evaluate([...common,'--paidSeats=111']);
  assert.equal(below.monthlyContributionBeforeOmittedCostsUsd, -11.2);
  assert.equal(pass.monthlyContributionBeforeOmittedCostsUsd, 6.88);
  assert.equal(pass.projectFeeReceiptsUsd, 0);
});

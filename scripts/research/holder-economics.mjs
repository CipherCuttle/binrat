/**
 * BINRAT independent, purely illustrative cash-contribution calculator.
 * NO token price, APR, price prediction, Pons guarantees, wallet or network access.
 */
const defaults = Object.freeze({
  volumeUsd: 100000,
  effectiveFeeBps: 35,
  paidSeats: 25,
  seatPriceUsd: 12,
  merchantFeeBps: 500,
  seatVariableCostUsd: 2,
  fixedCostUsd: 600
});
const keys = Object.keys(defaults);
function wholeNumber(value, name, cap = 1_000_000_000) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > cap) {
    throw new Error('RESEARCH_INPUT_INVALID:' + name);
  }
  return value;
}
const roundedDiv = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
const ceilDiv = (numerator, denominator) => (numerator + denominator - 1n) / denominator;
const usd = (cents) => Number(cents) / 100;

export function evaluateScenario(input = {}) {
  for (const key of Object.keys(input)) {
    if (!keys.includes(key)) throw new Error('RESEARCH_UNKNOWN_INPUT:' + key);
  }
  const x = { ...defaults, ...input };
  wholeNumber(x.volumeUsd, 'volumeUsd');
  wholeNumber(x.effectiveFeeBps, 'effectiveFeeBps', 10000);
  wholeNumber(x.paidSeats, 'paidSeats', 1000000);
  wholeNumber(x.seatPriceUsd, 'seatPriceUsd', 1000000);
  wholeNumber(x.merchantFeeBps, 'merchantFeeBps', 10000);
  wholeNumber(x.seatVariableCostUsd, 'seatVariableCostUsd', 1000000);
  wholeNumber(x.fixedCostUsd, 'fixedCostUsd');
  const volumeCents = BigInt(x.volumeUsd) * 100n;
  const feeBps = BigInt(x.effectiveFeeBps);
  const seats = BigInt(x.paidSeats);
  const grossSeatsCents = seats * BigInt(x.seatPriceUsd) * 100n;
  const merchantCents = roundedDiv(grossSeatsCents * BigInt(x.merchantFeeBps), 10000n);
  const paidNetCents = grossSeatsCents - merchantCents;
  const projectFeeCents = roundedDiv(volumeCents * feeBps, 10000n);
  const seatCostCents = seats * BigInt(x.seatVariableCostUsd) * 100n;
  const fixedCents = BigInt(x.fixedCostUsd) * 100n;
  const contributionCents = projectFeeCents + paidNetCents - seatCostCents - fixedCents;
  const requiredFeesCents = fixedCents + seatCostCents - paidNetCents;
  // Integer dollar break-even is conservatively rounded up; no assumed fee
  // collection timing, tax or FX conversion is included.
  const breakEvenVolumeUsd = requiredFeesCents <= 0n ? 0
    : feeBps === 0n ? null
    : Number(ceilDiv(requiredFeesCents * 10000n, feeBps * 100n));
  if (breakEvenVolumeUsd !== null && !Number.isSafeInteger(breakEvenVolumeUsd)) {
    throw new Error('RESEARCH_BREAK_EVEN_OUT_OF_RANGE');
  }
  return {
    status: 'ILLUSTRATIVE_NOT_FORECAST',
    assumptions: x,
    projectFeeReceiptsUsd: usd(projectFeeCents),
    seatRevenueGrossUsd: usd(grossSeatsCents),
    merchantFeesUsd: usd(merchantCents),
    seatRevenueNetUsd: usd(paidNetCents),
    seatVariableCostUsd: usd(seatCostCents),
    fixedCostUsd: usd(fixedCents),
    monthlyContributionBeforeOmittedCostsUsd: usd(contributionCents),
    breakEvenEligibleMonthlyVolumeUsd: breakEvenVolumeUsd,
    notIncluded: [
      'Taxes and VAT',
      'Founder salary',
      'Legal/security expenses beyond assumed fixed cost',
      'ETH/USD volatility and conversion costs',
      'Pons fee policy changes and post-graduation economics',
      'Actual fee collection eligibility and timing'
    ]
  };
}
function cliArgs(argv) {
  const values = {};
  for (const arg of argv) {
    const match = /^--([A-Za-z]+)=(\d+)$/.exec(arg);
    if (!match) throw new Error('RESEARCH_ARG_INVALID:' + arg);
    const key = match[1];
    if (!keys.includes(key)) throw new Error('RESEARCH_UNKNOWN_INPUT:' + key);
    if (Object.hasOwn(values, key)) throw new Error('RESEARCH_ARG_DUPLICATE:' + key);
    values[key] = Number(match[2]);
  }
  return values;
}
if (process.argv[1] && /(?:^|[/\\])holder-economics\.mjs$/.test(process.argv[1])) {
  try {
    process.stdout.write(JSON.stringify(evaluateScenario(cliArgs(process.argv.slice(2))), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(String(error instanceof Error ? error.message : error) + '\n');
    process.exitCode = 1;
  }
}

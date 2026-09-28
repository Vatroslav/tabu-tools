// Money is held in integer minor units (cents, fening, para) to avoid float drift.
// Rates are integers in basis points (1 bp = 0.01 %), so 16.5 % = 1650.
// Each line item is rounded half away from zero; later items use the rounded value.

export function fromDecimal(value) {
  return Math.round(Number(value) * 100);
}

export function toDecimal(minor) {
  return minor / 100;
}

// amount * num / den, rounded half away from zero.
export function mulDiv(amount, num, den) {
  const p = amount * num;
  const q = Math.floor((Math.abs(p) * 2 + den) / (2 * den));
  return p < 0 ? -q : q;
}

export function applyRate(amount, bp) {
  return mulDiv(amount, bp, 10000);
}

// Picks the parameter set in force for a 'YYYY-MM' period.
// Periods after the last known set reuse it and are flagged as provisional.
export function pickParams(sets, period) {
  const sorted = [...sets].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  let chosen = null;
  for (const s of sorted) {
    if (s.validFrom <= period) chosen = s;
  }
  if (!chosen) {
    throw new RangeError(`No parameters for period ${period}`);
  }
  const provisional = Boolean(chosen.validTo && period > chosen.validTo);
  return { params: chosen, provisional };
}

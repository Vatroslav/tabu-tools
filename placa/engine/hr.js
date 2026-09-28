// Croatia - monthly salary calculation (employee in an employment relationship).
import { applyRate, mulDiv, pickParams } from './money.js';
import { HR_PARAMS } from './params-hr.js';

const DEFAULTS = {
  period: '2026-01',
  gross: 0,
  rates: { lowerBp: 2000, higherBp: 3000 }, // statutory default when a local unit set no rates
  pillar2: true,
  weeklyHours: 40,
  totalGross: null, // gross from all employers, when working for more than one
  allowanceShare: 100, // percent of the personal allowance used at this employer (0 = no tax card)
  disability: 'none', // taxpayer: 'none' | 'partial' | 'full'
  children: [], // [{ share: 0..100, disability }] in birth order, including children claimed by the other parent
  dependents: [], // [{ share: 0..100, disability }]
  assistedArea: false, // resident of a group I local unit or Vukovar (P1 on the tax card)
  hrviPercent: 0, // Croatian war veteran disability percentage, ZPD čl. 42
  insuredAbroad: false, // A1 certificate, no Croatian contributions
  boardMember: false,
  firstEmployment: false, // first permanent contract, first 12 months: no health contribution
  legacyYouthExemption: false, // youth exemption started before 2025
  fallenDefenderChild: false, // Zakon o hrvatskim braniteljima čl. 106
  extendedService: null, // '12/14' | '12/15' | '12/16' | '12/18'
  birthYear: null, // for the annual youth refund estimate
  returnee: false, // ZPD čl. 46 st. 3, annual refund
};

function normalize(input) {
  const i = { ...DEFAULTS, ...input, rates: { ...DEFAULTS.rates, ...(input.rates || {}) } };
  const withShare = (x) => ({ share: 100, disability: 'none', ...x });
  i.children = i.children.map(withShare);
  i.dependents = i.dependents.map(withShare);
  if (i.children.length > 9) {
    throw new RangeError('At most 9 children are supported');
  }
  return i;
}

function disabilityTenths(kind, p) {
  return kind === 'none' ? 0 : p.disabilityCoefTenths[kind];
}

// Full monthly personal allowance before splitting across employers.
function allowanceUnits(i, p) {
  // units = coefficient in tenths x share percent
  let units = 10 * 100;
  units += disabilityTenths(i.disability, p) * 100;
  i.children.forEach((c, idx) => {
    units += (p.childCoefTenths[idx] + disabilityTenths(c.disability, p)) * c.share;
  });
  i.dependents.forEach((d) => {
    units += (p.dependentCoefTenths + disabilityTenths(d.disability, p)) * d.share;
  });
  return units;
}

function lowWageRelief(total, gross, p) {
  const r = p.lowWageRelief;
  let full = 0;
  if (total <= r.fullReliefUpTo) full = Math.min(r.fixedRelief, total);
  else if (total <= r.reliefEndsAt) full = mulDiv(r.reliefEndsAt - total, 1, 2);
  if (total === gross) return full;
  return mulDiv(full, gross, total);
}

function incomeTax(base, rates, threshold) {
  const lower = applyRate(Math.min(base, threshold), rates.lowerBp);
  const higher = applyRate(Math.max(0, base - threshold), rates.higherBp);
  return { lower, higher };
}

export function youthPercentFor(birthYear, year, p) {
  if (!birthYear) return 0;
  const age = year - birthYear; // age is taken for the whole tax year
  if (age <= p.youth.fullReliefMaxAge) return 100;
  if (age <= p.youth.halfReliefMaxAge) return 50;
  return 0;
}

// Annual income tax on salary after the youth reduction (ZPD čl. 46 st. 2, 7).
// The youth reduction applies only to tax at the lower rate; P1 halving comes after it.
export function hrAnnualTaxDue({ annualBase, rates, youthPercent = 0, assistedArea = false }, p) {
  const { lower, higher } = incomeTax(annualBase, rates, p.annualTaxThreshold);
  const youthReduction = mulDiv(lower, youthPercent, 100);
  let due = lower + higher - youthReduction;
  if (assistedArea) due = mulDiv(due, 1, 2);
  return { lower, higher, youthReduction, due };
}

function annualEstimate(i, p, taxBase, monthlyTax) {
  const year = Number(i.period.slice(0, 4));
  const youthPct = i.returnee ? 0 : youthPercentFor(i.birthYear, year, p);
  if (!youthPct && !i.returnee) return null;
  if (i.allowanceShare !== 100 || (i.totalGross && i.totalGross !== i.gross)) {
    return { available: false, reason: 'multipleEmployers' };
  }
  if (i.hrviPercent > 0) {
    // the statutory order of the veteran and youth reductions in the annual return is not specified
    return { available: false, reason: 'hrviAnnualOrder' };
  }
  let due = 0; // returnee: salary is the only income assumed, so no tax is due
  if (!i.returnee) {
    due = hrAnnualTaxDue(
      { annualBase: 12 * taxBase, rates: i.rates, youthPercent: youthPct, assistedArea: i.assistedArea },
      p,
    ).due;
  }
  const paid = 12 * monthlyTax;
  return {
    available: true,
    kind: i.returnee ? 'returnee' : 'youth',
    youthPercent: youthPct,
    paid,
    due,
    refund: paid - due,
  };
}

// overrides: optional parameter replacements, used by tests that replay older published examples.
export function calculateHR(input, overrides = null) {
  const i = normalize(input);
  const picked = pickParams(HR_PARAMS, i.period);
  const p = overrides ? { ...picked.params, ...overrides } : picked.params;
  const { provisional } = picked;
  const notes = [];
  const gross = i.gross;

  let base = gross;
  if (!i.insuredAbroad) {
    const floor = i.boardMember ? p.boardMemberMinBase : mulDiv(p.minBase, i.weeklyHours, 40);
    if (gross < floor) {
      base = floor;
      notes.push('minBaseApplied');
    }
  }
  const pensionBase = Math.min(base, p.maxBase);

  let relief = 0;
  let pension1 = 0;
  let pension2 = 0;
  if (!i.insuredAbroad) {
    relief = lowWageRelief(i.totalGross ?? gross, gross, p);
    pension1 = applyRate(Math.max(0, pensionBase - relief), i.pillar2 ? p.pension1Bp : p.pension1OnlyBp);
    pension2 = i.pillar2 ? applyRate(pensionBase, p.pension2Bp) : 0;
  }
  const income = gross - pension1 - pension2;

  const allowanceFull = mulDiv(p.personalAllowance, allowanceUnits(i, p), 1000);
  const allowance = mulDiv(allowanceFull, i.allowanceShare, 100);
  const allowanceUsed = Math.min(allowance, Math.max(0, income));
  const taxBase = Math.max(0, income - allowanceUsed);
  const { lower: taxLower, higher: taxHigher } = incomeTax(taxBase, i.rates, p.monthlyTaxThreshold);

  let tax = taxLower + taxHigher;
  let hrviRelief = 0;
  let areaRelief = 0;
  if (i.hrviPercent > 0) {
    const after = mulDiv(tax, 100 - i.hrviPercent, 100);
    hrviRelief = tax - after;
    tax = after;
  }
  if (i.assistedArea) {
    const after = mulDiv(tax, 1, 2);
    areaRelief = tax - after;
    tax = after;
  }
  const net = income - tax;

  const healthExempt =
    i.insuredAbroad || i.firstEmployment || i.legacyYouthExemption || i.fallenDefenderChild;
  const health = healthExempt ? 0 : applyRate(base, p.healthBp);
  let extended = 0;
  if (i.extendedService && !i.insuredAbroad) {
    const [withPillar2, pillar2Part, onlyPillar1] = p.extendedServiceBp[i.extendedService];
    extended = i.pillar2
      ? applyRate(pensionBase, withPillar2) + applyRate(pensionBase, pillar2Part)
      : applyRate(pensionBase, onlyPillar1);
  }
  const employerCost = gross + health + extended;

  if (gross < mulDiv(p.minimumWage, i.weeklyHours, 40)) notes.push('belowMinimumWage');

  return {
    country: 'HR',
    currency: p.currency,
    period: i.period,
    provisional,
    gross,
    net,
    employerCost,
    items: {
      contributionBase: base,
      lowWageRelief: relief,
      pension1,
      pension2,
      income,
      allowance,
      taxBase,
      taxLower,
      taxHigher,
      hrviRelief,
      areaRelief,
      tax,
      health,
      extendedService: extended,
    },
    annual: annualEstimate(i, p, taxBase, tax),
    notes,
  };
}

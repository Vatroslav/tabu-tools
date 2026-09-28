// Serbia - monthly salary calculation. "gross" is bruto 1 (zarada incl. employee contributions).
import { applyRate, mulDiv, pickParams } from './money.js';
import { SRB_PARAMS, SRB_ANNUAL_2025 } from './params-srb.js';

const DEFAULTS = {
  period: '2026-01',
  gross: 0,
  workShare: 100, // percent of full time
  multipleEmployers: false, // part time with two or more employers: minimum base is split
  partMonth: null, // { hoursWorked, hoursFund } when salary covers only part of the month
  newResident: null, // 'type1' | 'type2' (ZPDG čl. 15v)
  disabledEnterprise: false, // employee of an enterprise for employment of persons with disabilities
  retiree: false, // employed old-age pensioner: no unemployment contribution
  voluntaryInsurance: 0, // voluntary pension / health premium withheld from salary
  insuredAbroad: false,
  extendedService: null, // '12/14' | '12/15' | '12/16' | '12/18'
  employerIncentive: null, // 'startup' | 'disabledEmployee' | 'rnd' | 'newHire'
  rndShare: 0, // percent of working time on research and development
  newHireBand: 'small', // 'small' | '1-9' | '10-99' | '100+'
  nonTaxable: 0, // non-taxable payments (transport, per diem...) added to the payout
  ageAtYearEnd: null, // for the annual tax estimate
  dependents: 0,
};

function contributions(base, rates, skipUnemployment) {
  const out = {};
  for (const [k, bp] of Object.entries(rates)) {
    out[k] = k === 'unemployment' && skipUnemployment ? 0 : applyRate(base, bp);
  }
  return out;
}

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// Annual income tax on employment income (ZPDG čl. 87-89).
export function srbAnnualTax({ annualNet, under40 = false, dependents = 0 }, a = SRB_ANNUAL_2025) {
  let income = annualNet;
  if (under40) income -= Math.min(a.youthExtraDeduction, income);
  const aboveThreshold = income - a.threshold;
  if (aboveThreshold <= 0) return { base: 0, tax: 0 };
  const deductions = Math.min(
    a.personalDeduction + a.dependentDeduction * dependents,
    mulDiv(aboveThreshold, 1, 2),
  );
  const base = aboveThreshold - deductions;
  const tax =
    applyRate(Math.min(base, a.higherRateFrom), a.lowerBp) +
    applyRate(Math.max(0, base - a.higherRateFrom), a.higherBp);
  return { base, tax };
}

export function calculateSRB(input, overrides = null) {
  const i = { ...DEFAULTS, ...input };
  const picked = pickParams(SRB_PARAMS, i.period);
  const p = overrides ? { ...picked.params, ...overrides } : picked.params;
  const notes = [];
  const gross = i.gross;

  const [worked, fund] = i.partMonth ? [i.partMonth.hoursWorked, i.partMonth.hoursFund] : [1, 1];
  const untaxed = mulDiv(p.untaxed, i.workShare * worked, 100 * fund);
  let minBase = i.multipleEmployers ? mulDiv(p.minBase, i.workShare, 100) : p.minBase;
  minBase = mulDiv(minBase, worked, fund);

  let newResident = false;
  if (i.newResident) {
    newResident = gross > p.newResidentThreshold[i.newResident];
    if (!newResident) notes.push('newResidentBelowThreshold');
  }
  const contributionSource = newResident ? mulDiv(gross, p.newResidentKeepPercent, 100) : gross;
  let base = Math.min(Math.max(contributionSource, minBase), p.maxBase);
  if (contributionSource < minBase) notes.push('minBaseApplied');
  if (contributionSource > p.maxBase) notes.push('maxBaseApplied');
  if (i.insuredAbroad) base = 0;

  const employee = contributions(base, p.employee, i.retiree);
  const employeeTotal = sum(employee);

  let voluntary = 0;
  if (i.voluntaryInsurance > 0) {
    if (p.voluntaryInsuranceCap === null) notes.push('voluntaryCapUnknown');
    voluntary = Math.min(i.voluntaryInsurance, p.voluntaryInsuranceCap ?? 0);
  }
  let taxable = Math.max(0, gross - untaxed - voluntary);
  if (newResident) taxable = mulDiv(taxable, p.newResidentKeepPercent, 100);
  const tax = i.disabledEnterprise ? 0 : applyRate(taxable, p.taxBp);
  const net = gross - employeeTotal - tax;

  const employer = contributions(base, p.employer, false);
  const employerTotal = sum(employer);
  const extended = i.extendedService ? applyRate(base, p.extendedServiceBp[i.extendedService]) : 0;
  const employerCost = gross + employerTotal + extended + i.nonTaxable;

  // Incentives: the payslip is unchanged, the employer keeps or recovers part of the levies.
  let employerRelief = 0;
  let employerReliefTiming = null;
  switch (i.employerIncentive) {
    case 'startup': {
      // ZPDG čl. 21e / ZDOSO čl. 45d: levies on salary up to the cap are not paid.
      // Literal reading: only the part above the cap is taxed and subject to contributions.
      const above = Math.max(0, gross - p.startupCap);
      const paidTax = applyRate(above, p.taxBp);
      const aboveBase = Math.min(above, base);
      const paidContrib = sum(contributions(aboveBase, p.employee, i.retiree)) + sum(contributions(aboveBase, p.employer, false));
      employerRelief = tax - paidTax + employeeTotal + employerTotal - paidContrib;
      employerReliefTiming = 'immediate';
      notes.push('startupInterpretation');
      break;
    }
    case 'disabledEmployee': // ZPDG čl. 21g / ZDOSO čl. 45b, first three years
      employerRelief = tax + employerTotal;
      employerReliefTiming = 'immediate';
      break;
    case 'rnd': {
      // ZPDG čl. 21i / ZDOSO čl. 45z, proportional to research time
      const taxPart = mulDiv(applyRate(tax, p.rndTaxExemptPercent * 100), i.rndShare, 100);
      const pensionPart = mulDiv(employee.pension + employer.pension, i.rndShare, 100);
      employerRelief = taxPart + pensionPart;
      employerReliefTiming = 'immediate';
      break;
    }
    case 'newHire': // ZPDG čl. 21v, 21d / ZDOSO čl. 45, 45v - refund after payment
      employerRelief = mulDiv(tax + employeeTotal + employerTotal, p.newHireRefundPercent[i.newHireBand], 100);
      employerReliefTiming = 'refund';
      break;
    default:
      break;
  }

  if (i.retiree) notes.push('retireeSecondarySource');

  let annual = null;
  if (i.ageAtYearEnd !== null) {
    const est = srbAnnualTax({
      annualNet: 12 * net,
      under40: i.ageAtYearEnd < 40,
      dependents: i.dependents,
    });
    if (est.tax > 0) annual = { available: true, kind: 'annualTax', incomeYear: SRB_ANNUAL_2025.incomeYear, ...est };
  }

  return {
    country: 'SRB',
    currency: p.currency,
    period: i.period,
    provisional: picked.provisional,
    gross,
    net,
    payout: net - i.voluntaryInsurance + i.nonTaxable,
    employerCost,
    effectiveEmployerCost: employerCost - employerRelief,
    items: {
      untaxed,
      contributionBase: base,
      pension: employee.pension,
      health: employee.health,
      unemployment: employee.unemployment,
      taxable,
      tax,
      employerPension: employer.pension,
      employerHealth: employer.health,
      extendedService: extended,
      employerRelief,
      employerReliefTiming,
    },
    annual,
    notes,
  };
}

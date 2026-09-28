// Federation of BiH - monthly salary calculation.
import { applyRate, mulDiv, pickParams, rateItems, sumValues } from './money.js';
import { FBIH_PARAMS } from './params-bih.js';
import { solveSmallest } from './solve.js';

const DEFAULTS = {
  period: '2026-01',
  gross: 0,
  taxCard: true, // personal allowance is used only at the employer holding the tax card
  factorTenths: null, // direct factor from the tax card, e.g. 27 for 2.7; overrides family fields
  spouse: false,
  children: 0,
  otherDependents: 0,
  disabilities: 0, // taxpayer and each dependant with an established disability
  hoursPerDay: 8,
  specialSector: false, // mining, textile, leather, footwear, traditional crafts, pay up to 85 % of the average
  extendedService: null, // '12/14' | '12/15' | '12/16'
  disabilityFundSmall: false, // employer with up to 15 staff and no employee with a disability
  workerAid: 0, // non-taxable aid, 2026 only
  nonTaxable: 0, // meal allowance, transport, holiday pay within the limits
};

export function factorTenthsFor(i, p) {
  if (!i.taxCard) return 0;
  if (i.factorTenths !== null) return i.factorTenths;
  const f = p.factorTenths;
  let t = f.base + (i.spouse ? f.spouse : 0);
  for (let c = 0; c < i.children; c++) t += f.children[Math.min(c, f.children.length - 1)];
  t += i.otherDependents * f.otherDependent + i.disabilities * f.disability;
  return t;
}

function core(gross, base, factor, p) {
  const employee = rateItems(base, p.employee);
  const contrib = sumValues(employee);
  const income = gross - contrib;
  const allowance = mulDiv(p.allowanceUnit, factor, 10);
  const taxBase = Math.max(0, income - allowance);
  const tax = applyRate(taxBase, p.taxBp);
  return { employee, contrib, income, allowance, taxBase, tax, net: income - tax };
}

// Gross equivalent of the net minimum wage for a given tax card factor.
export function fbihMinimumGross(factor, p = FBIH_PARAMS[0]) {
  return solveSmallest((g) => core(g, g, factor, p).net, p.minimumNet).gross;
}

export function calculateFBIH(input, overrides = null) {
  const i = { ...DEFAULTS, ...input };
  const picked = pickParams(FBIH_PARAMS, i.period);
  const p = overrides ? { ...picked.params, ...overrides } : picked.params;
  const notes = [];
  const gross = i.gross;
  const factor = factorTenthsFor(i, p);

  let base = gross;
  if (i.specialSector) {
    base = p.specialSectorBase;
  } else {
    const minGross = fbihMinimumGross(factor, p);
    const floor = i.hoursPerDay <= 4 ? mulDiv(minGross, p.partTimeMinBasePercent, 100) : minGross;
    if (gross < floor) {
      base = floor;
      notes.push('minBaseApplied');
    }
  }

  const c = core(gross, base, factor, p);
  const employer = rateItems(base, p.employer);
  const employerTotal = sumValues(employer);
  const extended = i.extendedService ? applyRate(base, p.extendedServiceBp[i.extendedService]) : 0;
  const fees = rateItems(c.net, p.feesOnNetBp);
  const disabilityFund = i.disabilityFundSmall ? applyRate(gross, p.disabilityFundSmallBp) : 0;
  const aid = Math.min(i.workerAid, p.workerAidCap ?? 0);
  if (i.workerAid > aid) notes.push('workerAidCapped');

  const employerCost = gross + employerTotal + extended + sumValues(fees) + disabilityFund + aid + i.nonTaxable;

  return {
    country: 'FBIH',
    currency: p.currency,
    period: i.period,
    provisional: picked.provisional,
    gross,
    net: c.net,
    payout: c.net + aid + i.nonTaxable,
    employerCost,
    effectiveEmployerCost: employerCost,
    items: {
      factorTenths: factor,
      contributionBase: base,
      pension: c.employee.pension,
      health: c.employee.health,
      unemployment: c.employee.unemployment,
      income: c.income,
      allowance: c.allowance,
      taxBase: c.taxBase,
      tax: c.tax,
      employerPension: employer.pension,
      employerHealth: employer.health,
      employerUnemployment: employer.unemployment,
      extendedService: extended,
      disasterProtectionFee: fees.disasterProtection,
      waterFee: fees.water,
      disabilityFund,
    },
    annual: null,
    notes,
  };
}

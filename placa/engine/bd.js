// Brčko District - monthly salary calculation.
// Pension contributions follow the entity fund the employee is registered with (RS or FBiH);
// health, unemployment and income tax follow District rules.
import { applyRate, mulDiv, pickParams } from './money.js';
import { BD_PARAMS } from './params-bih.js';

const DEFAULTS = {
  period: '2026-01',
  gross: 0,
  pensionFund: 'RS', // 'RS' | 'FBIH'
  taxCard: true,
  entityResident: false, // lives in FBiH or RS: basic allowance only
  spouse: false,
  children: 0, // dependent children up to age 27
  disabilityPercents: [], // established disability of the taxpayer and each dependant, e.g. [60, 40]
  permanentlyDisabledMembers: 0,
  businessEmployer: true, // legal entities and entrepreneurs pay the general water fee
  disabilityFund: false, // private employer without an employee with a disability
  nonTaxable: 0,
};

export function bdFactorTenths(i, p) {
  if (!i.taxCard) return 0;
  const f = p.factorTenths;
  if (i.entityResident) return f.base;
  let t = f.base + (i.spouse ? f.spouse : 0) + i.children * f.child;
  for (const pct of i.disabilityPercents) t += Math.floor(pct / 20) * f.per20PercentDisability;
  t += i.permanentlyDisabledMembers * f.permanentlyDisabledMember;
  return t;
}

export function calculateBD(input, overrides = null) {
  const i = { ...DEFAULTS, ...input };
  const picked = pickParams(BD_PARAMS, i.period);
  const p = overrides ? { ...picked.params, ...overrides } : picked.params;
  const notes = ['bdMinimumBaseNotModelled'];
  const gross = i.gross;

  const pension = applyRate(gross, p.pensionByFund[i.pensionFund]);
  const health = applyRate(gross, p.health);
  const unemployment = applyRate(gross, p.unemployment);
  const income = gross - pension - health - unemployment;

  const factor = bdFactorTenths(i, p);
  const allowance = mulDiv(p.allowance, factor, 10);
  const taxBase = Math.max(0, income - allowance);
  const tax = applyRate(taxBase, p.taxBp);
  const net = income - tax;

  const employerPension = applyRate(gross, p.employerPensionByFund[i.pensionFund]);
  const waterFee = i.businessEmployer ? applyRate(net, p.waterFeeOnNetBp) : 0;
  const disabilityFund = i.disabilityFund ? applyRate(gross, p.disabilityFundBp) : 0;
  if (i.disabilityFund) notes.push('bdDisabilityFundStart');
  const employerCost = gross + employerPension + waterFee + disabilityFund + i.nonTaxable;

  return {
    country: 'BD',
    currency: p.currency,
    period: i.period,
    provisional: picked.provisional,
    gross,
    net,
    payout: net + i.nonTaxable,
    employerCost,
    effectiveEmployerCost: employerCost,
    items: {
      factorTenths: factor,
      pension,
      health,
      unemployment,
      income,
      allowance,
      taxBase,
      tax,
      employerPension,
      waterFee,
      disabilityFund,
    },
    annual: null,
    notes,
  };
}

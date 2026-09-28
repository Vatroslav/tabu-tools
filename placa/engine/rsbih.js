// Republika Srpska (BiH entity) - monthly salary calculation.
// Contributions (31 %) are withheld from gross; gross equals the employer's cost.
// Income tax (8 %) is levied on gross less the exempt part and allowances; contributions are not deducted.
import { applyRate, mulDiv, pickParams } from './money.js';
import { RSBIH_PARAMS } from './params-bih.js';

const DEFAULTS = {
  period: '2026-01',
  gross: 0,
  jobCategory: 'secondary4', // education required for the job: none | secondary3 | secondary4 | higher | university
  workShare: 100, // percent of full time
  multipleEmployers: false,
  taxCard: true,
  dependents: 0,
  housingInterest: 0, // monthly interest on a first-home loan, via the tax card
  lifeInsurance: 0, // monthly premium
  voluntaryPension: 0, // monthly voluntary pension contribution
  solidarityExempt: false,
  disabilityFund: null, // 'private' | 'public' when the employer misses the quota
  previousGross: null, // for the wage-increase incentive estimate
  nonTaxable: 0,
};

// Splits the total so the items add up to it; the last item absorbs rounding.
function split(total, base, rates) {
  const keys = Object.keys(rates);
  const out = {};
  let used = 0;
  keys.forEach((k, idx) => {
    out[k] = idx === keys.length - 1 ? total - used : applyRate(base, rates[k]);
    used += out[k];
  });
  return out;
}

export function calculateRSBIH(input, overrides = null) {
  const i = { ...DEFAULTS, ...input };
  const picked = pickParams(RSBIH_PARAMS, i.period);
  const p = overrides ? { ...picked.params, ...overrides } : picked.params;
  const notes = [];
  const gross = i.gross;

  const exemptCategory = p.exemptCategories.includes(i.jobCategory);
  const exempt = exemptCategory ? mulDiv(p.exemptPart, i.workShare, 100) : 0;
  if (exemptCategory && i.workShare < 100) notes.push('exemptPartProrated');
  const voluntary = Math.min(i.voluntaryPension, p.voluntaryPensionMonthlyCap);

  // Minimum contribution base: minimum gross for the job category, less the exempt part.
  let floor = p.minimumGross[i.jobCategory] - (exemptCategory ? p.exemptPart : 0);
  if (i.multipleEmployers) floor = mulDiv(floor, i.workShare, 100);
  const source = gross - exempt - voluntary;
  let base = source;
  if (source < floor) {
    base = floor;
    notes.push('minBaseApplied');
  }

  const contributions = applyRate(base, p.contributionsBp);
  const parts = split(contributions, base, p.contributionSplit);

  let allowance = 0;
  if (i.taxCard) {
    allowance =
      mulDiv(p.allowance, i.workShare, 100) +
      p.dependentAllowance * i.dependents +
      i.housingInterest +
      Math.min(i.lifeInsurance, p.lifeInsuranceMonthlyCap);
  }
  const taxBase = Math.max(0, gross - exempt - voluntary - allowance);
  const tax = applyRate(taxBase, p.taxBp);
  const net = gross - contributions - tax;
  const solidarity = i.solidarityExempt ? 0 : applyRate(net, p.solidarityBp);

  const disabilityFund = i.disabilityFund ? applyRate(gross, p.disabilityFundBp[i.disabilityFund]) : 0;
  const employerCost = gross + disabilityFund + i.nonTaxable;

  let annual = null;
  if (i.previousGross) {
    // Zakon o podsticajima u privredi: 70 % of the extra contributions over the year, capped.
    const previous = applyRate(Math.max(i.previousGross - exempt, floor), p.contributionsBp);
    const extra = Math.max(0, 12 * (contributions - previous));
    const refund = Math.min(p.wageIncreaseRefund.annualCap, mulDiv(extra, p.wageIncreaseRefund.percent, 100));
    annual = { available: true, kind: 'wageIncrease', refund };
  }

  return {
    country: 'RSBIH',
    currency: p.currency,
    period: i.period,
    provisional: picked.provisional,
    gross,
    net,
    payout: net - solidarity + i.nonTaxable,
    employerCost,
    effectiveEmployerCost: employerCost,
    items: {
      exemptPart: exempt,
      contributionBase: base,
      pension: parts.pension,
      health: parts.health,
      unemployment: parts.unemployment,
      childProtection: parts.childProtection,
      contributions,
      allowance,
      taxBase,
      tax,
      solidarity,
      disabilityFund,
    },
    annual,
    notes,
  };
}

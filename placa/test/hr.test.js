import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHR, hrAnnualTaxDue } from '../engine/hr.js';
import { HR_PARAMS } from '../engine/params-hr.js';
import { fromDecimal as eur } from '../engine/money.js';
import { netToGrossHR } from '../engine/index.js';

const ZAGREB = { lowerBp: 2300, higherBp: 3300 };
const DEFAULT_RATES = { lowerBp: 2000, higherBp: 3000 };
const P2026 = HR_PARAMS[0];

// Porezna uprava brochure on the pillar I base reduction (18.12.2023), 2024 parameters:
// personal allowance 560 EUR, Veliko Trojstvo lower rate 17.5 %. The examples do not involve
// the minimum contribution base.
const BROCHURE_2024 = { personalAllowance: 56000, minBase: 0 };
const TROJSTVO = { lowerBp: 1750, higherBp: 3000 };

test('PU brochure: gross 500, pillars I and II', () => {
  const r = calculateHR({ gross: eur(500), rates: TROJSTVO }, BROCHURE_2024);
  assert.equal(r.items.lowWageRelief, eur(300));
  assert.equal(r.items.pension1, eur(30));
  assert.equal(r.items.pension2, eur(25));
  assert.equal(r.net, eur(445));
});

test('PU brochure: gross 250, relief capped at gross', () => {
  const r = calculateHR({ gross: eur(250), rates: TROJSTVO }, BROCHURE_2024);
  assert.equal(r.items.lowWageRelief, eur(250));
  assert.equal(r.items.pension1, 0);
  assert.equal(r.items.pension2, eur(12.5));
  assert.equal(r.net, eur(237.5));
});

test('PU brochure: gross 1100, pillars I and II', () => {
  const r = calculateHR({ gross: eur(1100), rates: TROJSTVO }, BROCHURE_2024);
  assert.equal(r.items.lowWageRelief, eur(100));
  assert.equal(r.items.pension1, eur(150));
  assert.equal(r.items.pension2, eur(55));
  assert.equal(r.items.tax, eur(58.63));
  assert.equal(r.net, eur(836.37));
});

test('PU brochure: gross 1100, pillar I only', () => {
  const r = calculateHR({ gross: eur(1100), rates: TROJSTVO, pillar2: false }, BROCHURE_2024);
  assert.equal(r.items.pension1, eur(200));
  assert.equal(r.items.tax, eur(59.5));
  assert.equal(r.net, eur(840.5));
});

// G. Lončar (Porezna uprava), InSOLVE 20.11.2024 - 2025 parameters, unchanged in 2026. Zagreb.
test('InSOLVE: gross 3500, no dependants', () => {
  assert.equal(calculateHR({ gross: eur(3500), rates: ZAGREB }).net, eur(2294));
});

test('InSOLVE: gross 3500, one dependant', () => {
  const r = calculateHR({ gross: eur(3500), rates: ZAGREB, dependents: [{}] });
  assert.equal(r.net, eur(2363));
});

test('InSOLVE: gross 7000, tax base exactly at the threshold', () => {
  const r = calculateHR({ gross: eur(7000), rates: ZAGREB });
  assert.equal(r.items.taxBase, eur(5000));
  assert.equal(r.net, eur(4450));
});

// Minimum wage 2026 (1050 EUR), published by fiskai.hr and brojevi.hr.
test('minimum wage 2026, Zagreb', () => {
  const r = calculateHR({ gross: eur(1050), rates: ZAGREB });
  assert.equal(r.items.lowWageRelief, eur(125));
  assert.equal(r.items.pension1, eur(138.75));
  assert.equal(r.items.pension2, eur(52.5));
  assert.equal(r.items.tax, eur(59.51));
  assert.equal(r.net, eur(799.24));
  assert.equal(r.items.health, eur(173.25));
  assert.equal(r.employerCost, eur(1223.25));
});

test('minimum wage 2026, Osijek 20 %', () => {
  assert.equal(calculateHR({ gross: eur(1050), rates: DEFAULT_RATES }).net, eur(807));
});

test('minimum wage 2026, two dependants: no tax', () => {
  const r = calculateHR({ gross: eur(1050), rates: DEFAULT_RATES, dependents: [{}, {}] });
  assert.equal(r.net, eur(858.75));
});

// Derived from the statutory formula (no published example): above the pension cap.
test('gross 15000 Zagreb: pension capped, health on full gross', () => {
  const r = calculateHR({ gross: eur(15000), rates: ZAGREB });
  assert.equal(r.items.pension1, eur(1793.7));
  assert.equal(r.items.pension2, eur(597.9));
  assert.equal(r.items.taxLower, eur(1150));
  assert.equal(r.items.taxHigher, eur(2312.77));
  assert.equal(r.net, eur(9145.63));
  assert.equal(r.employerCost, eur(17475));
});

test('assisted area and war veteran reductions (derived)', () => {
  const base = { gross: eur(2500), rates: DEFAULT_RATES };
  assert.equal(calculateHR({ ...base, assistedArea: true }).net, eur(1860));
  const veteran = calculateHR({ ...base, assistedArea: true, hrviPercent: 60, disability: 'full' });
  assert.equal(veteran.items.allowance, eur(1200));
  assert.equal(veteran.items.tax, eur(32));
  assert.equal(veteran.net, eur(1968));
});

test('children coefficients follow birth order, shared children keep their place', () => {
  const r = calculateHR({
    gross: eur(3000),
    rates: DEFAULT_RATES,
    children: [{ share: 0 }, { share: 0 }, { share: 100 }],
  });
  assert.equal(r.items.allowance, eur(1200)); // 600 x (1 + 1.0 for the third child)
});

test('first permanent job and extended service change only employer cost', () => {
  const plain = calculateHR({ gross: eur(2000) });
  const first = calculateHR({ gross: eur(2000), firstEmployment: true });
  assert.equal(first.net, plain.net);
  assert.equal(first.employerCost, eur(2000));
  const extended = calculateHR({ gross: eur(2000), extendedService: '12/14' });
  assert.equal(extended.items.extendedService, eur(97.2)); // 4.86 %
});

test('low wage relief split across employers', () => {
  // PU example: three employers, gross 500 / 600 / 300, total 1400 -> no relief above 1300
  // so use total 1200 here: relief 50, split by share of gross (derived)
  const r = calculateHR({ gross: eur(600), totalGross: eur(1200), weeklyHours: 20 });
  assert.equal(r.items.lowWageRelief, eur(25));
});

// Porezna uprava youth example (2024, Samobor 18 %, annual tax base 6080 EUR).
test('annual youth reduction: 100 % and 50 %', () => {
  const rates = { lowerBp: 1800, higherBp: 2800 };
  const full = hrAnnualTaxDue({ annualBase: eur(6080), rates, youthPercent: 100 }, P2026);
  assert.equal(full.youthReduction, eur(1094.4));
  const half = hrAnnualTaxDue({ annualBase: eur(6080), rates, youthPercent: 50 }, P2026);
  assert.equal(half.youthReduction, eur(547.2));
});

test('annual youth refund estimate from monthly salary (derived)', () => {
  const r = calculateHR({ gross: eur(2000), rates: DEFAULT_RATES, birthYear: 2001 });
  assert.equal(r.annual.refund, eur(2400));
  const older = calculateHR({ gross: eur(2000), rates: DEFAULT_RATES, birthYear: 1998 });
  assert.equal(older.annual.refund, eur(1200));
  const p1 = calculateHR({ gross: eur(2000), rates: DEFAULT_RATES, birthYear: 1998, assistedArea: true });
  assert.equal(p1.annual.refund, eur(600));
});

test('net to gross returns the smallest matching gross', () => {
  const a = netToGrossHR({ rates: DEFAULT_RATES }, eur(2000));
  assert.equal(a.gross, eur(2937.49));
  assert.ok(a.exact);
  const b = netToGrossHR({ rates: ZAGREB }, eur(9145.63));
  assert.equal(b.gross, eur(15000));
});

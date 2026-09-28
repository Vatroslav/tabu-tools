import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSRB, srbAnnualTax } from '../engine/srb.js';
import { fromDecimal as rsd } from '../engine/money.js';
import { netToGross } from '../engine/index.js';

// pitajknjigovodju.rs and feruvi.rs, 2026 parameters.
test('gross 100000: net and bruto 2', () => {
  const r = calculateSRB({ gross: rsd(100000) });
  assert.equal(r.items.pension + r.items.health + r.items.unemployment, rsd(19900));
  assert.equal(r.items.tax, rsd(6577.9));
  assert.equal(r.net, rsd(73522.1));
  assert.equal(r.employerCost, rsd(115150));
});

test('gross 80000 and 150000', () => {
  assert.equal(calculateSRB({ gross: rsd(80000) }).net, rsd(59502.1));
  assert.equal(calculateSRB({ gross: rsd(150000) }).net, rsd(108572.1));
});

// Minimum wage January 2026 (176 h x 371): net 65296. pitajknjigovodju.rs publishes gross 88265.19;
// rounding each contribution separately needs 88265.20 for the same net.
test('minimum wage January 2026, per-item rounding', () => {
  assert.equal(calculateSRB({ gross: rsd(88265.19) }).net, rsd(65295.99));
  const r = netToGross('SRB', {}, rsd(65296));
  assert.equal(r.gross, rsd(88265.2));
  assert.equal(calculateSRB({ gross: r.gross }).employerCost, rsd(101637.38));
});

// pitajknjigovodju.rs: half time with one employer, contributions on the full minimum base.
test('half time, one employer, below the minimum base', () => {
  const r = calculateSRB({ gross: rsd(48330.07), workShare: 50 });
  assert.equal(r.items.untaxed, rsd(17110.5));
  assert.equal(r.items.contributionBase, rsd(51297));
  assert.equal(r.items.pension, rsd(7181.58));
  assert.equal(r.items.health, rsd(2641.8));
  assert.equal(r.items.unemployment, rsd(384.73));
  assert.equal(r.items.tax, rsd(3121.96));
  assert.equal(r.net, rsd(35000));
});

// Derived from the statutory formula: above the maximum base.
test('gross 1000000: contributions capped at the maximum base', () => {
  const r = calculateSRB({ gross: rsd(1000000) });
  assert.equal(r.items.pension + r.items.health + r.items.unemployment, rsd(145831.18));
  assert.equal(r.net, rsd(757590.92));
  assert.equal(r.employerCost, rsd(1111022.23));
});

test('2027 uses the new non-taxable amount and is provisional', () => {
  const r = calculateSRB({ gross: rsd(100000), period: '2027-01' });
  assert.equal(r.items.untaxed, rsd(37369));
  assert.equal(r.items.tax, rsd(6263.1));
  assert.ok(r.provisional);
});

test('payment month decides the parameters (December salary paid in January)', () => {
  const dec = calculateSRB({ gross: rsd(100000), period: '2026-12' });
  const jan = calculateSRB({ gross: rsd(100000), period: '2027-01' });
  assert.notEqual(dec.net, jan.net);
});

// Derived: new resident type 1, gross 500000 (2026).
test('new resident: tax and contribution bases reduced by 70 %', () => {
  const r = calculateSRB({ gross: rsd(500000), newResident: 'type1' });
  assert.equal(r.items.tax, rsd(13973.37));
  assert.equal(r.items.contributionBase, rsd(150000));
  assert.equal(r.net, rsd(456176.63));
  assert.equal(r.employerCost, rsd(522725));
});

test('new resident below the threshold gets no relief', () => {
  const r = calculateSRB({ gross: rsd(300000), newResident: 'type1' });
  assert.equal(r.net, calculateSRB({ gross: rsd(300000) }).net);
  assert.ok(r.notes.includes('newResidentBelowThreshold'));
});

test('employer incentives leave the net unchanged', () => {
  const plain = calculateSRB({ gross: rsd(100000) });
  for (const employerIncentive of ['startup', 'disabledEmployee', 'rnd', 'newHire']) {
    const r = calculateSRB({ gross: rsd(100000), employerIncentive, rndShare: 100 });
    assert.equal(r.net, plain.net);
    assert.ok(r.effectiveEmployerCost < r.employerCost);
  }
  const startup = calculateSRB({ gross: rsd(100000), employerIncentive: 'startup' });
  assert.equal(startup.effectiveEmployerCost, rsd(100000) - (plain.gross - plain.net)); // nothing is remitted
});

test('part of the month: non-taxable amount and minimum base are prorated', () => {
  const r = calculateSRB({ gross: rsd(50000), partMonth: { hoursWorked: 88, hoursFund: 176 } });
  assert.equal(r.items.untaxed, rsd(17110.5));
  assert.equal(r.items.contributionBase, rsd(50000));
});

// Tax Administration brochure (April 2026), 2025 income: base 12,950,452 -> tax 1,398,658.20.
test('annual income tax, published example', () => {
  const a = srbAnnualTax({ annualNet: 0 });
  assert.equal(a.tax, 0);
  // Reconstruct the published base: net income = base + deductions + threshold.
  const base = rsd(12950452);
  const deductions = rsd(725213);
  const r = srbAnnualTax({ annualNet: base + deductions + rsd(5439096) });
  assert.equal(r.base, base);
  assert.equal(r.tax, rsd(1398658.2));
});
